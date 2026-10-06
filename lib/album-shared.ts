export type Album = {
  id: string;
  name: string;
  photoIds: string[];
  coverPhotoId: string | null;
  created_at: string;
  updated_at: string;
};
export const albumUrl = (album: Pick<Album, 'id'>) => `/gallery/albums/${album.id}`;
