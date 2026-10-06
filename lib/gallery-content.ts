import { imageUrl, imagePreviewUrl, type Post } from './post-shared';
import { galleryAsset } from './seed-gallery';
import { galleryLikeCounts } from './gallery-likes';
import type { GalleryPhoto } from './gallery-shared';
import { previewMetadata } from './image-previews';

export async function galleryPhotos(posts: Post[]): Promise<GalleryPhoto[]> {
  const [counts, metadata] = await Promise.all([
    galleryLikeCounts().catch(error => { console.error(error); return {} as Record<string, number>; }),
    previewMetadata(),
  ]);
  return posts.filter(post => post.kind === 'photo' && post.image_key).sort((a, b) => b.taken_at.localeCompare(a.taken_at)).map(photo => {
    const asset = galleryAsset(photo.image_key);
    const info = photo.image_key ? metadata[photo.image_key] : undefined;
    const thumbnail = imagePreviewUrl(photo), smallThumbnail = imagePreviewUrl(photo, 'thumb');
    const thumbnailSrcSet = info && info.thumb.width !== info.preview.width
      ? smallThumbnail + ' ' + info.thumb.width + 'w, ' + thumbnail + ' ' + info.preview.width + 'w'
      : undefined;
    return { id: photo.id, title: photo.title, body: photo.body, date: photo.taken_at, location: photo.location,
      src: imageUrl(photo), thumbnail, smallThumbnail, thumbnailSrcSet,
      aspectRatio: info ? info.width / info.height : asset ? asset.width / asset.height : 4 / 3,
      likes: counts[photo.id] || 0 };
  });
}
