import assets from './gallery-photos.json';
import type { Post } from './post-shared';

export const seedPhotos = assets.map(asset => asset.post) as Post[];
const byKey = new Map(assets.map(asset => [asset.post.image_key, asset]));
export function galleryAsset(key: string | null) {
  return key ? byKey.get(key) : undefined;
}
