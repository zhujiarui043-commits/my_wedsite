import assets from './gallery-photos.json';
import type { Post } from './post-shared';

export const seedPhotos = assets.map(asset => asset.post) as Post[];
export function galleryAsset(key: string | null) {
  return assets.find(asset => asset.post.image_key === key);
}
