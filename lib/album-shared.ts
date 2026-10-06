export type Album = {
  id: string;
  name: string;
  photoIds: string[];
  coverPhotoId: string | null;
  coverPosition?: { x: number; y: number };
  coverFit?: 'cover' | 'contain';
  created_at: string;
  updated_at: string;
};
export const albumUrl = (album: Pick<Album, 'id'>) => `/gallery/albums/${album.id}`;
export const coverObjectPosition = (album: Pick<Album, 'coverPosition'>) => `${album.coverPosition?.x ?? 50}% ${album.coverPosition?.y ?? 50}%`;
