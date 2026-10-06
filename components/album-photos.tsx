'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { PhotoLikeButton, useGalleryLikes } from './gallery-likes';
import type { GalleryPhoto } from '@/lib/gallery-shared';

export default function AlbumPhotos({ photos }: { photos: GalleryPhoto[] }) {
  const [selected, setSelected] = useState<GalleryPhoto | null>(null);
  const likes = useGalleryLikes(photos);
  const heart = (photo: GalleryPhoto) => <PhotoLikeButton title={photo.title} count={likes.counts[photo.id] || 0} liked={likes.liked.has(photo.id)} pending={likes.pending.has(photo.id)} ready={likes.ready} onToggle={() => { void likes.toggle(photo.id); }} />;
  return <>
    <section className="album-photo-grid" aria-label="Album photographs">{photos.map(photo => <article className="album-photo-card" key={photo.id}>
      <div className="album-photo-frame"><button className="album-photo-open" type="button" onClick={() => setSelected(photo)} aria-label={`View ${photo.title}`}><img src={photo.thumbnail} srcSet={photo.thumbnailSrcSet} sizes="(max-width: 760px) 90vw, (max-width: 1050px) 45vw, 390px" alt={photo.title} loading="lazy" decoding="async" /></button>{heart(photo)}</div>
      <h2>{photo.title}</h2>{(photo.location || photo.date) && <p>{[photo.location, photo.date].filter(Boolean).join(' · ')}</p>}
    </article>)}</section>
    {likes.error && <p className="photo-like-error" role="status">{likes.error} <button type="button" onClick={likes.retry}>Retry</button></p>}
    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="photo-dialog detail-dialog"><DialogTitle>{selected?.title}</DialogTitle><DialogDescription>{[selected?.date, selected?.location].filter(Boolean).join(' · ') || 'From my collection'}</DialogDescription>
      {selected && <div className="photo-detail-picture"><img className="detail-image" src={selected.src} alt={selected.title} />{heart(selected)}</div>}{selected?.body && <p className="detail-body">{selected.body}</p>}
    </DialogContent></Dialog>
  </>;
}
