import { imageUrl, type Post } from './post-shared';
import { galleryAsset } from './seed-gallery';
import { galleryLikeCounts } from './gallery-likes';
import type { GalleryPhoto } from './gallery-shared';

export async function galleryPhotos(posts: Post[]): Promise<GalleryPhoto[]> {
  const counts = await galleryLikeCounts().catch(error => { console.error(error); return {} as Record<string, number>; });
  return posts.filter(post => post.kind === 'photo' && post.image_key).sort((a, b) => b.taken_at.localeCompare(a.taken_at)).map(photo => {
    const asset = galleryAsset(photo.image_key);
    return { id: photo.id, title: photo.title, body: photo.body, date: photo.taken_at, location: photo.location, src: imageUrl(photo), thumbnail: asset?.thumbnail ?? imageUrl(photo), aspectRatio: asset ? asset.width / asset.height : 4 / 3, likes: counts[photo.id] || 0 };
  });
}
