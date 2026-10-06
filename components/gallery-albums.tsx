import Link from 'next/link';
import { Images, ArrowUpRight } from 'lucide-react';
import { albumUrl, type Album } from '@/lib/album-shared';
import type { GalleryPhoto } from '@/lib/gallery-shared';

export default function GalleryAlbums({ albums, photos }: { albums: Album[]; photos: GalleryPhoto[] }) {
  const byId = new Map(photos.map(photo => [photo.id, photo]));
  return <section className="gallery-albums" aria-labelledby="albums-heading">
    <div className="gallery-albums-heading"><h2 id="albums-heading">Albums</h2><span>{albums.length} {albums.length === 1 ? 'collection' : 'collections'}</span></div>
    {albums.length ? <div className="gallery-album-grid">{albums.map(album => {
      const cover = album.coverPhotoId ? byId.get(album.coverPhotoId) : null;
      return <Link className="gallery-album-card" key={album.id} href={albumUrl(album)} aria-label={`Open ${album.name}`}>
        <div className="gallery-album-cover">{cover ? <img src={cover.thumbnail} alt={`${album.name} cover`} loading="lazy" decoding="async" /> : <div className="gallery-album-no-cover"><Images size={28} /><span>No cover selected</span></div>}</div>
        <div className="gallery-album-caption"><div><h3>{album.name}</h3><span>{album.photoIds.length} {album.photoIds.length === 1 ? 'photograph' : 'photographs'}</span></div><ArrowUpRight size={19} aria-hidden="true" /></div>
      </Link>;
    })}</div> : <p className="gallery-albums-empty">New collections will appear here.</p>}
  </section>;
}
