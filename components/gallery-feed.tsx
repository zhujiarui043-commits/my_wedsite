'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { imageUrl, imagePreviewUrl, type Post } from '@/lib/post-shared';

export default function GalleryFeed({ photos }: { photos: Post[] }) {
  const [selected, setSelected] = useState<Post | null>(null);
  return <>
    <section className="space-gallery-grid" aria-label="Photographs">
      {photos.map(photo => <button key={photo.id} className="space-gallery-card" onClick={() => setSelected(photo)} aria-label={`View ${photo.title}`}>
        <img src={imagePreviewUrl(photo)} alt={photo.title} loading="lazy" decoding="async" />
        <span className="space-gallery-caption"><strong>{photo.title}</strong><span>{photo.location || photo.taken_at}</span></span>
      </button>)}
    </section>
    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
      <DialogContent className="photo-dialog detail-dialog">
        <DialogTitle>{selected?.title}</DialogTitle>
        <DialogDescription>{selected?.taken_at}{selected?.location ? ` · ${selected.location}` : ''}</DialogDescription>
        {selected && <img className="detail-image" src={imageUrl(selected)} alt={selected.title} />}
        {selected?.body && <p className="detail-body">{selected.body}</p>}
      </DialogContent>
    </Dialog>
  </>;
}
