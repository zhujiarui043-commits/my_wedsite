import type { Metadata } from 'next';
import SpacePage from '@/components/space-page';
import PhotoSphere from '@/components/photo-sphere';
import { listPosts } from '@/lib/posts';
import { galleryPhotos } from '@/lib/gallery-content';
import { listAlbums } from '@/lib/albums';
import GalleryAlbums from '@/components/gallery-albums';
import { isFeaturedPhoto } from '@/lib/post-shared';
import './gallery.css';

export const metadata: Metadata = { title: 'Gallery | Jerry Zhu' };

export const dynamic = 'force-dynamic';
export default async function GalleryPage() {
  const posts = await listPosts();
  const [photos, albums] = await Promise.all([galleryPhotos(posts), listAlbums(posts)]);
  const featuredIds = new Set(posts.filter(isFeaturedPhoto).map(post => post.id));
  const featuredPhotos = photos.filter(photo => featuredIds.has(photo.id));
  return <SpacePage spaceId="gallery" fullWidth afterContent={<>
    {featuredPhotos.length ? <PhotoSphere photos={featuredPhotos} /> : <section className="notes-empty"><h2>No featured photographs yet.</h2><p>Selected photographs will appear on the planet.</p></section>}
    <GalleryAlbums albums={albums} photos={photos} />
  </>}>
    <span className="sr-only">Photographs from my life and travels.</span>
  </SpacePage>;
}
