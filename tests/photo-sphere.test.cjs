const { test } = require('node:test');
const assert = require('node:assert/strict');
const physics = import('../lib/photo-sphere-physics.ts');
const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} differs from ${b}`);

test('photos stay on a rigid spherical surface with empty polar caps through repeated rotation', async () => {
  const { spherePoints, multiply, axisAngle, rotateVector, length, IDENTITY } = await physics;
  const points = spherePoints(97); let q = [...IDENTITY];
  for (let i = 0; i < 10000; i++) q = multiply(axisAngle([.3, .7, -.2], .02), q);
  close(Math.hypot(...q), 1);
  const pole = rotateVector(q, [0, 1, 0]);
  for (const point of points) {
    const rotated = rotateVector(q, point);
    close(length(point), 1); close(length(rotated), 1);
    const polarAlignment = rotated.reduce((sum, value, index) => sum + value * pole[index], 0);
    assert.ok(Math.abs(polarAlignment) < Math.cos(Math.PI / 10), 'Photo entered an empty polar cap');
  }
  close(length(rotateVector(q, points[0]).map((value, index) => value - rotateVector(q, points[1])[index])), length(points[0].map((value, index) => value - points[1][index])));
});

function cross(a, b, c) { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); }
function inside(point, polygon) {
  const signs = polygon.map((a, index) => cross(a, polygon[(index + 1) % polygon.length], point));
  return signs.every(value => value >= 0) || signs.every(value => value <= 0);
}
function pointSegmentDistance(point, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], squared = dx * dx + dy * dy;
  const t = squared ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / squared)) : 0;
  return Math.hypot(point[0] - a[0] - dx * t, point[1] - a[1] - dy * t);
}
function polygonDistance(a, b) {
  if (a.some(point => inside(point, b)) || b.some(point => inside(point, a))) return 0;
  let distance = Infinity;
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    const p = a[i], q = a[(i + 1) % a.length], r = b[j], s = b[(j + 1) % b.length];
    const boundsMeet = [0, 1].every(axis => Math.max(Math.min(p[axis], q[axis]), Math.min(r[axis], s[axis])) <= Math.min(Math.max(p[axis], q[axis]), Math.max(r[axis], s[axis])));
    if (boundsMeet && cross(p, q, r) * cross(p, q, s) <= 0 && cross(r, s, p) * cross(r, s, q) <= 0) return 0;
    distance = Math.min(distance, pointSegmentDistance(p, r, s), pointSegmentDistance(q, r, s), pointSegmentDistance(r, p, q), pointSegmentDistance(s, p, q));
  }
  return distance;
}
test('visible photographs leave real space between their edges at different rotations and screen sizes', async () => {
  const { spherePoints, axisAngle, multiply, visiblePhotoIndices, projectPhoto, PHOTO_BAND_LIMIT } = await physics;
  const points = spherePoints(97), aspects = [.72, .75, 1, 4 / 3, 1.5];
  for (const radius of [140.4, 281.6]) {
    const perspective = Math.max(850, radius * 6), gap = Math.max(3, Math.min(8, radius * .028));
    const edge = radius * Math.sqrt(4 * Math.PI * PHOTO_BAND_LIMIT / points.length) * .46;
    const sizes = points.map((_, index) => ({ width: edge * Math.min(1, aspects[index % aspects.length]), height: edge * Math.min(1, 1 / aspects[index % aspects.length]) }));
    for (let pose = 0; pose < 64; pose++) {
      const orientation = multiply(axisAngle([.3, .7, -.2], pose * 1.37), axisAngle([1, 0, 0], pose * .71));
      const shown = visiblePhotoIndices(points, orientation, radius, perspective, sizes, gap);
      assert.ok(shown.length > points.length / 4, 'Too many photographs were hidden');
      const quads = shown.map(index => projectPhoto(points[index], orientation, radius, perspective, sizes[index]));
      for (let i = 0; i < quads.length; i++) for (let j = i + 1; j < quads.length; j++) {
        assert.ok(polygonDistance(quads[i], quads[j]) >= gap - 1e-4, `Photographs crowded at rotation ${pose}`);
      }
    }
  }
});
test('every photograph becomes visible when rotated to the front', async () => {
  const { spherePoints, betweenVectors, visiblePhotoIndices } = await physics;
  const points = spherePoints(97), sizes = points.map(() => ({ width: 44, height: 44 }));
  points.forEach((point, index) => {
    const orientation = betweenVectors(point, [0, 0, 1]);
    assert.ok(visiblePhotoIndices(points, orientation, 281.6, 1689.6, sizes, 8).includes(index));
  });
});
test('horizontal and vertical drags follow the pointer without singularities', async () => {
  const { trackball, betweenVectors, rotateVector } = await physics;
  const start = trackball(0, 0);
  for (const [x, y] of [[.45, 0], [0, .45], [-.8, -.4], [10, -20]]) {
    const target = trackball(x, y), result = rotateVector(betweenVectors(start, target), start);
    target.forEach((value, index) => close(result[index], value));
  }
  const opposite = rotateVector(betweenVectors([0, 0, 1], [0, 0, -1]), [0, 0, 1]);
  close(opposite[2], -1);
});
test('inertia and friction give the same result at different display frame rates', async () => {
  const { advanceRotation, IDENTITY, length } = await physics;
  const simulate = fps => {
    let state = { orientation: [...IDENTITY], velocity: [.4, 2, -.2] };
    for (let i = 0; i < fps * 2; i++) state = advanceRotation(state.orientation, state.velocity, 1 / fps);
    return state;
  };
  const slow = simulate(30), fast = simulate(144);
  slow.orientation.forEach((value, index) => close(value, fast.orientation[index]));
  slow.velocity.forEach((value, index) => close(value, fast.velocity[index]));
  assert.ok(length(slow.velocity) < .01);
});
test('a click gives a small, decaying nudge and a stationary sphere stays still', async () => {
  const { advanceRotation, IDENTITY, quaternionVelocity, betweenVectors } = await physics;
  const nudge = advanceRotation(IDENTITY, [0, .24, 0], 3);
  const degrees = 2 * Math.acos(nudge.orientation[3]) * 180 / Math.PI;
  assert.ok(degrees > 3 && degrees < 6);
  assert.deepEqual(advanceRotation(IDENTITY, [0, 0, 0], 1).orientation, IDENTITY);
  assert.deepEqual(quaternionVelocity(betweenVectors([0, 0, 1], [0, 0, 1]), .016), [0, 0, 0]);
});
