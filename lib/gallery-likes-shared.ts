export const GALLERY_VISITOR_COOKIE = 'jerry_gallery_visitor';
export const GALLERY_LIKES_PATH = '/api/gallery/likes';
export type GalleryLikeState = { counts: Record<string, number>; liked: string[] };
