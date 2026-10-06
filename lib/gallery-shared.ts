export type GalleryPhoto = {
  id: string;
  title: string;
  body: string;
  location: string;
  date: string;
  src: string;
  thumbnail: string;
  smallThumbnail?: string;
  thumbnailSrcSet?: string;
  aspectRatio: number;
  likes: number;
};
