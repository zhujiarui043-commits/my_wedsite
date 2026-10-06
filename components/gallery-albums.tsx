import Link from 'next/link';
import { Images, ArrowUpRight } from 'lucide-react';
import { albumUrl, coverObjectPosition, type Album } from '@/lib/album-shared';
import type { GalleryPhoto } from '@/lib/gallery-shared';

export default function GalleryAlbums({ albums, photos }: { albums: Album[]; photos: GalleryPhoto[] }) {
  const byId = new Map(photos.map(photo => [photo.id, photo]));
  return <section className="gallery-albums" aria-labelledby="albums-heading">
    <div className="gallery-albums-heading"><h2 id="albums-heading">Albums</h2><span>{albums.length} {albums.length === 1 ? 'collection' : 'collections'}</span></div>
    {albums.length ? <div className="gallery-album-grid">{albums.map(album => {
      const cover = album.coverPhotoId ? byId.get(album.coverPhotoId) : null;
      return <Link className="gallery-album-card" key={album.id} href={albumUrl(album)} prefetch={false} aria-label={`Open ${album.name}`}>
        <div className="gallery-album-cover" data-fit={album.coverFit ?? 'cover'}>{cover ? <img src={cover.thumbnail} srcSet={cover.thumbnailSrcSet} sizes="(max-width: 760px) 90vw, (max-width: 1050px) 45vw, 390px" alt={`${album.name} cover`} style={{ objectPosition: coverObjectPosition(album), objectFit: album.coverFit ?? 'cover' }} loading="lazy" decoding="async" /> : <div className="gallery-album-no-cover"><Images size={28} /><span>No cover selected</span></div>}</div>
        <div className="gallery-album-caption"><div><h3>{album.name}</h3><span>{album.photoIds.length} {album.photoIds.length === 1 ? 'photograph' : 'photographs'}</span></div><ArrowUpRight size={19} aria-hidden="true" /></div>
      </Link>;
    })}</div> : <p className="gallery-albums-empty">New collections will appear here.</p>}
  </section>;
}
