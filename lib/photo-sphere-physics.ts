export type Vector = [number, number, number];
export type Quaternion = [number, number, number, number];
export const IDENTITY: Quaternion = [0, 0, 0, 1];
export const DRAG_FRICTION = 2.8;
// Keep a smaller empty cap at each pole, with centers below 64 degrees latitude.
export const PHOTO_BAND_LIMIT = .9;
export type ScreenPoint = [number, number];
export type PhotoDimensions = { width: number; height: number };
const cssNumber = (value: number) => Number(value.toFixed(6));
export const length = (v: Vector) => Math.hypot(...v);
export function normalize(v: Vector): Vector {
  const magnitude = length(v);
  return magnitude > 1e-10 ? v.map(value => value / magnitude) as Vector : [0, 0, 0];
}
export function multiply(a: Quaternion, b: Quaternion): Quaternion {
  const [x, y, z, w] = a, [u, v, s, t] = b;
  const result = [w * u + x * t + y * s - z * v, w * v - x * s + y * t + z * u, w * s + x * v - y * u + z * t, w * t - x * u - y * v - z * s];
  const magnitude = Math.hypot(...result);
  return result.map(value => value / magnitude) as Quaternion;
}
export function axisAngle(axis: Vector, angle: number): Quaternion {
  if (length(axis) < 1e-10 || Math.abs(angle) < 1e-10) return [...IDENTITY];
  const unit = normalize(axis), sine = Math.sin(angle / 2);
  return [unit[0] * sine, unit[1] * sine, unit[2] * sine, Math.cos(angle / 2)];
}
export function betweenVectors(from: Vector, to: Vector): Quaternion {
  const a = normalize(from), b = normalize(to);
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  if (dot < -0.999999) {
    const axis: Vector = Math.abs(a[0]) < .8 ? [0, -a[2], a[1]] : [-a[1], a[0], 0];
    return axisAngle(axis, Math.PI);
  }
  const q: Quaternion = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0], 1 + dot];
  const magnitude = Math.hypot(...q);
  return q.map(value => value / magnitude) as Quaternion;
}
export function quaternionVelocity(q: Quaternion, seconds: number): Vector {
  const sine = Math.hypot(q[0], q[1], q[2]);
  if (sine < 1e-8 || seconds <= 0) return [0, 0, 0];
  const speed = Math.min(7, 2 * Math.atan2(sine, q[3]) / seconds);
  return [q[0] / sine * speed, q[1] / sine * speed, q[2] / sine * speed];
}
export function trackball(x: number, y: number): Vector {
  const squared = x * x + y * y;
  const z = squared <= .5 ? Math.sqrt(1 - squared) : .5 / Math.sqrt(squared);
  return normalize([x, y, z]);
}
export function advanceRotation(orientation: Quaternion, velocity: Vector, seconds: number, friction = DRAG_FRICTION) {
  const decay = Math.exp(-friction * Math.max(0, seconds));
  const angle = length(velocity) * (1 - decay) / friction;
  return { orientation: multiply(axisAngle(velocity, angle), orientation), velocity: velocity.map(value => value * decay) as Vector };
}
export function rotateVector(q: Quaternion, vector: Vector): Vector {
  const [x, y, z, w] = q, [a, b, c] = vector;
  const tx = 2 * (y * c - z * b), ty = 2 * (z * a - x * c), tz = 2 * (x * b - y * a);
  return [a + w * tx + y * tz - z * ty, b + w * ty + z * tx - x * tz, c + w * tz + x * ty - y * tx];
}
export function rotationMatrix(q: Quaternion) {
  const [x, y, z, w] = q;
  return `matrix3d(${[1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0, 2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0, 2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0, 0, 0, 0, 1].map(cssNumber).join(',')})`;
}
export function spherePoints(count: number): Vector[] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, index) => {
    const y = PHOTO_BAND_LIMIT * (1 - 2 * (index + .5) / count);
    const ring = Math.sqrt(1 - y * y), angle = index * goldenAngle;
    return [ring * Math.cos(angle), y, ring * Math.sin(angle)] as Vector;
  });
}
function photoBasis(point: Vector) {
  const [x, y, z] = point;
  const right = normalize([z, 0, -x]);
  const down: Vector = [y * right[2] - z * right[1], z * right[0] - x * right[2], x * right[1] - y * right[0]];
  return { right, down };
}
export function projectPhoto(point: Vector, orientation: Quaternion, radius: number, perspective: number, size: PhotoDimensions): ScreenPoint[] {
  const { right, down } = photoBasis(point);
  return ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as ScreenPoint[]).map(([horizontal, vertical]) => {
    const corner = point.map((value, index) => value * radius + right[index] * horizontal * size.width / 2 + down[index] * vertical * size.height / 2) as Vector;
    const [x, y, z] = rotateVector(orientation, corner);
    const scale = perspective / (perspective - z);
    return [x * scale, y * scale];
  });
}
export function quadsHaveGap(a: ScreenPoint[], b: ScreenPoint[], gap: number) {
  for (const polygon of [a, b]) {
    for (let index = 0; index < polygon.length; index++) {
      const next = polygon[(index + 1) % polygon.length];
      const dx = next[0] - polygon[index][0], dy = next[1] - polygon[index][1];
      const magnitude = Math.hypot(dx, dy);
      if (magnitude < 1e-10) continue;
      const axis: ScreenPoint = [-dy / magnitude, dx / magnitude];
      let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
      for (const point of a) { const value = point[0] * axis[0] + point[1] * axis[1]; aMin = Math.min(aMin, value); aMax = Math.max(aMax, value); }
      for (const point of b) { const value = point[0] * axis[0] + point[1] * axis[1]; bMin = Math.min(bMin, value); bMax = Math.max(bMax, value); }
      if (bMin - aMax >= gap || aMin - bMax >= gap) return true;
    }
  }
  return false;
}
export function visiblePhotoIndices(points: Vector[], orientation: Quaternion, radius: number, perspective: number, sizes: PhotoDimensions[], gap: number) {
  const candidates = points.map((point, index) => ({ index, facing: rotateVector(orientation, point)[2] }))
    .filter(photo => photo.facing > radius / perspective + .015)
    .sort((a, b) => b.facing - a.facing || a.index - b.index);
  const accepted: ScreenPoint[][] = [], indices: number[] = [];
  for (const candidate of candidates) {
    const quad = projectPhoto(points[candidate.index], orientation, radius, perspective, sizes[candidate.index]);
    // A distant edge photo yields when its projected rectangle would crowd a nearer photo.
    if (!accepted.every(other => quadsHaveGap(quad, other, gap))) continue;
    accepted.push(quad); indices.push(candidate.index);
  }
  return indices;
}
export function tileTransform(point: Vector) {
  const [x, y, z] = point;
  const { right, down } = photoBasis(point);
  return `translate3d(calc(${cssNumber(x)} * var(--sphere-radius)), calc(${cssNumber(y)} * var(--sphere-radius)), calc(${cssNumber(z)} * var(--sphere-radius))) matrix3d(${[...right, 0, ...down, 0, x, y, z, 0, 0, 0, 0, 1].map(cssNumber).join(',')}) translate(-50%, -50%)`;
}
