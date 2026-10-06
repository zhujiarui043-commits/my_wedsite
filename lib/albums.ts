import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { dataRoot } from './content-storage';
import { listPosts, type Post } from './posts';
import type { Album } from './album-shared';

const idPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export async function listAlbums(posts?: Post[]): Promise<Album[]> {
  let stored: Album[];
  try {
    stored = JSON.parse(await readFile(path.join(dataRoot, 'albums.json'), 'utf8'));
    if (!Array.isArray(stored) || stored.some(album => !album || !idPattern.test(album.id) || typeof album.name !== 'string' || !Array.isArray(album.photoIds) || !album.photoIds.every(id => typeof id === 'string' && idPattern.test(id)) || (album.coverPhotoId !== null && typeof album.coverPhotoId !== 'string') || typeof album.created_at !== 'string' || typeof album.updated_at !== 'string')) throw new Error('Invalid albums data');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  if (stored.some(album => album.coverFit !== undefined && album.coverFit !== 'cover' && album.coverFit !== 'contain')) throw new Error('Invalid album cover fit');
  const available = new Set((posts ?? await listPosts()).filter(post => post.kind === 'photo' && post.image_key).map(post => post.id));
  // Deleted photographs disappear from every album; a removed cover needs a new choice.
  return stored.map(album => {
    const photoIds = [...new Set(album.photoIds)].filter(id => available.has(id));
    return { ...album, photoIds, coverPhotoId: album.coverPhotoId && photoIds.includes(album.coverPhotoId) ? album.coverPhotoId : null };
  });
}
