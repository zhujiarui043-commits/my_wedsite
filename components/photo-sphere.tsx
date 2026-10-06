'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import type { GalleryPhoto } from '@/lib/gallery-shared';
import { PhotoLikeButton, useGalleryLikes } from './gallery-likes';
import { advanceRotation, axisAngle, betweenVectors, length, multiply, PHOTO_BAND_LIMIT, quaternionVelocity, rotateVector, rotationMatrix, spherePoints, tileTransform, trackball, visiblePhotoIndices, type PhotoDimensions, type Quaternion, type Vector } from '@/lib/photo-sphere-physics';

const INITIAL = multiply(axisAngle([0, 1, 0], .24), axisAngle([1, 0, 0], -.12));
type Controller = { reset: () => void; pause: (paused: boolean) => void };

export default function PhotoSphere({ photos }: { photos: GalleryPhoto[] }) {
  const [selected, setSelected] = useState<GalleryPhoto | null>(null);
  const likes = useGalleryLikes(photos);
  const stage = useRef<HTMLDivElement>(null), world = useRef<HTMLDivElement>(null);
  const controller = useRef<Controller | null>(null);
  const points = useMemo(() => spherePoints(photos.length), [photos.length]);
  const aspects = useMemo(() => photos.map(photo => Math.max(.72, Math.min(1.5, photo.aspectRatio))), [photos]);

  useEffect(() => {
    const surface = stage.current, globe = world.current;
    if (!surface || !globe) return;
    const tiles = Array.from(globe.querySelectorAll<HTMLDivElement>('.photo-sphere-tile'));
    const buttons = tiles.map(tile => Array.from(tile.querySelectorAll<HTMLButtonElement>('button')));
    const fronts: (boolean | undefined)[] = tiles.map(() => undefined);
    const opacities = tiles.map(() => 0);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let orientation: Quaternion = [...INITIAL], velocity: Vector = [0, 0, 0];
    let radius = 320, perspective = 1920, gap = 8, frame = 0, timestamp = 0, visible = true, paused = false;
    let sizes: PhotoDimensions[] = [];
    let dragging: { id: number; capture: HTMLElement; startX: number; startY: number; vector: Vector; time: number; moved: boolean } | null = null;

    function paint() {
      globe!.style.transform = rotationMatrix(orientation);
      const shown = new Set(visiblePhotoIndices(points, orientation, radius, perspective, sizes, gap));
      tiles.forEach((tile, index) => {
        const front = shown.has(index);
        const opacity = front ? .48 + Math.max(0, rotateVector(orientation, points[index])[2]) * .52 : 0;
        if (fronts[index] !== front || Math.abs(opacities[index] - opacity) > .003) {
          tile.style.opacity = String(opacity);
          opacities[index] = opacity;
        }
        if (fronts[index] !== front) {
          tile.style.pointerEvents = front ? 'auto' : 'none';
          buttons[index].forEach(button => { button.tabIndex = front ? 0 : -1; });
          tile.setAttribute('aria-hidden', front ? 'false' : 'true');
          fronts[index] = front;
        }
      });
    }
    function animate(time: number) {
      frame = 0;
      if (!visible || paused || document.hidden) { timestamp = 0; return; }
      const seconds = timestamp ? Math.min((time - timestamp) / 1000, .06) : 0;
      timestamp = time;
      if (!dragging && !motion.matches && length(velocity) > .002) {
        const next = advanceRotation(orientation, velocity, seconds);
        orientation = next.orientation; velocity = next.velocity;
      }
      paint();
      if (!dragging && !motion.matches && length(velocity) > .002) frame = requestAnimationFrame(animate);
      else timestamp = 0;
    }
    function wake() { if (!frame && visible && !paused && !document.hidden) frame = requestAnimationFrame(animate); }
    function localVector(event: PointerEvent) {
      const bounds = surface!.getBoundingClientRect();
      return trackball((event.clientX - bounds.left - bounds.width / 2) / radius, (event.clientY - bounds.top - bounds.height / 2) / radius);
    }
    function down(event: PointerEvent) {
      if (!event.isPrimary || event.button !== 0 || paused || dragging) return;
      if ((event.target as HTMLElement).closest('.photo-like')) { velocity = [0, 0, 0]; return; }
      event.preventDefault();
      velocity = [0, 0, 0]; timestamp = 0;
      surface!.focus({ preventScroll: true });
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>('.photo-sphere-open') || surface!;
      dragging = { id: event.pointerId, capture: target, startX: event.clientX, startY: event.clientY, vector: localVector(event), time: event.timeStamp, moved: false };
      target.setPointerCapture(event.pointerId);
      surface!.classList.add('is-dragging');
    }
    function move(event: PointerEvent) {
      if (!dragging || event.pointerId !== dragging.id) return;
      if (Math.hypot(event.clientX - dragging.startX, event.clientY - dragging.startY) >= 6) dragging.moved = true;
      if (!dragging.moved) return;
      const vector = localVector(event), delta = betweenVectors(dragging.vector, vector);
      const seconds = Math.max((event.timeStamp - dragging.time) / 1000, 1 / 240);
      orientation = multiply(delta, orientation);
      const nextVelocity = quaternionVelocity(delta, seconds), blend = 1 - Math.exp(-seconds / .025);
      velocity = velocity.map((value, index) => value * (1 - blend) + nextVelocity[index] * blend) as Vector;
      dragging.vector = vector; dragging.time = event.timeStamp;
      wake();
    }
    function finish(event: PointerEvent, cancelled = false) {
      if (!dragging || event.pointerId !== dragging.id) return;
      const gesture = dragging; dragging = null;
      surface!.classList.remove('is-dragging');
      if (gesture.capture.hasPointerCapture(event.pointerId)) gesture.capture.releasePointerCapture(event.pointerId);
      if (cancelled) { velocity = [0, 0, 0]; wake(); return; }
      if (!gesture.moved) {
        // A small angular impulse, followed by the same friction as a released drag.
        const point = localVector(event);
        velocity = [-point[1] * .06, .24, point[0] * .04];
        if (motion.matches) { orientation = multiply(axisAngle(velocity, .06), orientation); velocity = [0, 0, 0]; }
      } else if (event.timeStamp - gesture.time > 90 || motion.matches) velocity = [0, 0, 0];
      timestamp = 0; wake();
    }
    const up = (event: PointerEvent) => finish(event);
    const cancel = (event: PointerEvent) => finish(event, true);
    function keyboard(event: KeyboardEvent) {
      const directions: Record<string, Vector> = { ArrowLeft: [0, -1, 0], ArrowRight: [0, 1, 0], ArrowUp: [1, 0, 0], ArrowDown: [-1, 0, 0] };
      const axis = directions[event.key];
      if (!axis || paused) return;
      event.preventDefault(); velocity = [0, 0, 0]; orientation = multiply(axisAngle(axis, .1), orientation); paint();
    }
    function resize() {
      const bounds = surface!.getBoundingClientRect();
      radius = Math.min(bounds.width * .45, bounds.height * .44, 420);
      const tileSize = Math.min(radius * .3, radius * Math.sqrt(4 * Math.PI * PHOTO_BAND_LIMIT / photos.length) * .46);
      sizes = aspects.map(aspect => ({ width: tileSize * Math.min(1, aspect), height: tileSize * Math.min(1, 1 / aspect) }));
      perspective = Math.max(850, radius * 6);
      gap = Math.max(3, Math.min(8, radius * .028));
      surface!.style.setProperty('--sphere-radius', `${radius}px`);
      surface!.style.setProperty('--sphere-tile-size', `${tileSize}px`);
      surface!.style.perspective = `${perspective}px`;
      paint();
    }
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(surface);
    const visibilityObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; timestamp = 0; if (visible) wake(); }); visibilityObserver.observe(surface);
    const visibilityChange = () => { timestamp = 0; if (!document.hidden) wake(); };
    const motionChange = () => { velocity = [0, 0, 0]; paint(); };
    surface.addEventListener('pointerdown', down);
    surface.addEventListener('pointermove', move);
    surface.addEventListener('pointerup', up);
    surface.addEventListener('pointercancel', cancel);
    surface.addEventListener('lostpointercapture', cancel);
    surface.addEventListener('keydown', keyboard);
    document.addEventListener('visibilitychange', visibilityChange);
    motion.addEventListener('change', motionChange);
    controller.current = {
      reset() { orientation = [...INITIAL]; velocity = [0, 0, 0]; paint(); },
      pause(value) { paused = value; velocity = [0, 0, 0]; timestamp = 0; if (!value) wake(); },
    };
    resize();
    return () => {
      cancelAnimationFrame(frame); resizeObserver.disconnect(); visibilityObserver.disconnect();
      surface.removeEventListener('pointerdown', down); surface.removeEventListener('pointermove', move);
      surface.removeEventListener('pointerup', up); surface.removeEventListener('pointercancel', cancel);
      surface.removeEventListener('lostpointercapture', cancel); surface.removeEventListener('keydown', keyboard);
      document.removeEventListener('visibilitychange', visibilityChange); motion.removeEventListener('change', motionChange);
      controller.current = null;
    };
  }, [photos.length, points, aspects]);

  useEffect(() => { controller.current?.pause(!!selected); }, [selected]);

  return <section className="photo-sphere" aria-label="Photo planet">
    <div ref={stage} className="photo-sphere-stage" role="group" aria-label="Interactive photo sphere" aria-describedby="photo-sphere-instructions" tabIndex={0}>
      <div className="photo-sphere-halo" aria-hidden="true" />
      <div ref={world} className="photo-sphere-world" style={{ transform: rotationMatrix(INITIAL) }}>
        {photos.map((photo, index) => {
          const aspect = aspects[index];
          return <div key={photo.id} className="photo-sphere-tile" style={{ transform: tileTransform(points[index]), opacity: 0, '--photo-width': Math.min(1, aspect).toFixed(6), '--photo-height': Math.min(1, 1 / aspect).toFixed(6) } as CSSProperties} aria-hidden="true">
            <button type="button" className="photo-sphere-open" aria-label={`View ${photo.title}`} tabIndex={-1}
              onDoubleClick={event => { event.stopPropagation(); setSelected(photo); }} onClick={event => { if (event.detail === 0) setSelected(photo); }}>
              <img src={photo.smallThumbnail ?? photo.thumbnail} alt={photo.title} draggable={false} loading="lazy" decoding="async" />
            </button>
            <PhotoLikeButton compact title={photo.title} count={likes.counts[photo.id] || 0} liked={likes.liked.has(photo.id)} pending={likes.pending.has(photo.id)} ready={likes.ready} onToggle={() => { void likes.toggle(photo.id); }} />
          </div>;
        })}
      </div>
    </div>
    <div className="photo-sphere-footer"><span>{photos.length} photographs</span><p id="photo-sphere-instructions">Drag to rotate · Click to nudge · Double-click a photo to view<span className="sr-only">. Use the arrow keys to rotate, or press Enter on a photograph to open it.</span></p><button onClick={() => controller.current?.reset()} aria-label="Reset sphere rotation"><RotateCcw size={14} />Reset view</button></div>
    {likes.error && <p className="photo-like-error" role="status">{likes.error} <button type="button" onClick={likes.retry}>Retry</button></p>}
    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
      <DialogContent className="photo-dialog detail-dialog"><DialogTitle>{selected?.title}</DialogTitle><DialogDescription>{[selected?.date, selected?.location].filter(Boolean).join(' · ') || 'From my collection'}</DialogDescription>
        {selected && <div className="photo-detail-picture"><img className="detail-image" src={selected.src} alt={selected.title} />
          <PhotoLikeButton title={selected.title} count={likes.counts[selected.id] || 0} liked={likes.liked.has(selected.id)} pending={likes.pending.has(selected.id)} ready={likes.ready} onToggle={() => { void likes.toggle(selected.id); }} />
        </div>}
        {selected?.body && <p className="detail-body">{selected.body}</p>}
      </DialogContent>
    </Dialog>
  </section>;
}
