'use client';

import { useEffect, useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import type { GalleryPhoto } from '@/lib/gallery-shared';
import { GALLERY_LIKES_PATH, type GalleryLikeState } from '@/lib/gallery-likes-shared';

export function useGalleryLikes(photos: GalleryPhoto[]) {
  const [counts, setCounts] = useState<Record<string, number>>(() => Object.fromEntries(photos.map(photo => [photo.id, photo.likes])));
  const [liked, setLiked] = useState(new Set<string>());
  const [pending, setPending] = useState(new Set<string>());
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  const likedRef = useRef(new Set<string>()), pendingRef = useRef(new Set<string>()), revision = useRef(0);
  const refreshRef = useRef<(() => void) | null>(null), channelRef = useRef<BroadcastChannel | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    async function refresh() {
      if (document.hidden || pendingRef.current.size) return;
      const before = revision.current;
      try {
        const response = await fetch(GALLERY_LIKES_PATH, { cache: 'no-store', credentials: 'same-origin' });
        if (!response.ok) throw new Error();
        const state = await response.json() as GalleryLikeState;
        if (!active || before !== revision.current) return;
        likedRef.current = new Set(state.liked);
        setLiked(new Set(state.liked)); setCounts(state.counts); setReady(true); setError('');
      } catch { if (active && before === revision.current) setError('Likes are temporarily unavailable. Please try again.'); }
    }
    const reload = () => { void refresh(); };
    refreshRef.current = reload;
    reload();
    const interval = window.setInterval(reload, 15000);
    window.addEventListener('focus', reload); document.addEventListener('visibilitychange', reload);
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel('jerry-gallery-likes') : null;
    channelRef.current = channel;
    if (channel) channel.onmessage = reload;
    return () => {
      active = false; mounted.current = false;
      window.clearInterval(interval); window.removeEventListener('focus', reload); document.removeEventListener('visibilitychange', reload);
      channel?.close(); channelRef.current = null; refreshRef.current = null;
    };
  }, [photos]);

  async function toggle(id: string) {
    if (!ready || pendingRef.current.has(id)) return;
    const next = !likedRef.current.has(id), delta = next ? 1 : -1;
    pendingRef.current.add(id); setPending(new Set(pendingRef.current)); revision.current++;
    if (next) likedRef.current.add(id); else likedRef.current.delete(id);
    setLiked(new Set(likedRef.current)); setCounts(previous => ({ ...previous, [id]: Math.max(0, (previous[id] || 0) + delta) })); setError('');
    let failed = false;
    try {
      const response = await fetch(GALLERY_LIKES_PATH, {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, liked: next }),
      });
      if (!response.ok) throw new Error();
      const result = await response.json() as { id: string; count: number; liked: boolean };
      if (mounted.current) {
        setCounts(previous => ({ ...previous, [id]: result.count }));
        if (result.liked) likedRef.current.add(id); else likedRef.current.delete(id);
        setLiked(new Set(likedRef.current)); channelRef.current?.postMessage({ id });
      }
    } catch {
      failed = true;
      if (mounted.current) {
        if (next) likedRef.current.delete(id); else likedRef.current.add(id);
        setLiked(new Set(likedRef.current)); setCounts(previous => ({ ...previous, [id]: Math.max(0, (previous[id] || 0) - delta) }));
        setError('Could not save your like. Please try again.');
      }
    } finally {
      pendingRef.current.delete(id);
      if (mounted.current) { setPending(new Set(pendingRef.current)); if (!failed) refreshRef.current?.(); }
    }
  }
  return { counts, liked, pending, ready, error, toggle, retry: () => refreshRef.current?.() };
}

const compactCount = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 0 });
export function PhotoLikeButton({ title, count, liked, pending, ready, compact = false, onToggle }: {
  title: string; count: number; liked: boolean; pending: boolean; ready: boolean; compact?: boolean; onToggle: () => void;
}) {
  const label = `${liked ? 'Unlike' : 'Like'} ${title} (${count} ${count === 1 ? 'like' : 'likes'})`;
  return <button type="button" className={`photo-like${compact ? ' photo-like--compact' : ''}`} title={label} aria-label={label}
    aria-pressed={liked} aria-busy={pending} disabled={!ready} tabIndex={compact ? -1 : 0}
    onDoubleClick={event => event.stopPropagation()} onClick={event => { event.preventDefault(); event.stopPropagation(); onToggle(); }}>
    <Heart aria-hidden="true" size={compact ? 7 : 16} /><span aria-hidden="true">{compact ? compactCount.format(count) : count.toLocaleString('en')}</span>
  </button>;
}
