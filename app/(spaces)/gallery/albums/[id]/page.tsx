import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SpacePage from '@/components/space-page';
import AlbumPhotos from '@/components/album-photos';
import { listAlbums } from '@/lib/albums';
import { listPosts } from '@/lib/posts';
import { galleryPhotos } from '@/lib/gallery-content';
import '../../gallery.css';

type Props = { params: Promise<{ id: string }> };
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const album = (await listAlbums()).find(item => item.id === id);
  if (!album) notFound();
  return { title: `${album.name} | Gallery | Jerry Zhu` };
}
export default async function AlbumPage({ params }: Props) {
  const { id } = await params, posts = await listPosts();
  const album = (await listAlbums(posts)).find(item => item.id === id);
  if (!album) notFound();
  const allPhotos = await galleryPhotos(posts), byId = new Map(allPhotos.map(photo => [photo.id, photo]));
  const photos = album.photoIds.flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
  return <SpacePage spaceId="gallery" title={album.name} fullWidth backLink={{ href: '/gallery', label: 'Back to Gallery' }} afterContent={photos.length ? <AlbumPhotos photos={photos} /> : <section className="notes-empty"><h2>No photographs yet.</h2><p>New photographs will appear here.</p></section>}>
    <p className="gallery-album-count">{photos.length} {photos.length === 1 ? 'photograph' : 'photographs'}</p>
  </SpacePage>;
}
