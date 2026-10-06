import { isFeaturedPhoto, type Post } from './post-shared';

export async function toggleFeaturedPhoto(photo: Post): Promise<Post> {
  const response = await fetch('/api/gallery/featured', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: photo.id, featured: !isFeaturedPhoto(photo) }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not update the planet selection.');
  return data.post;
}
