import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { dataRoot, writeContentFile } from './content-storage';
import { listPosts, type Post } from './posts';
import { ContentError } from './editor-image';
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
  const available = new Set((posts ?? await listPosts()).filter(post => post.kind === 'photo' && post.image_key).map(post => post.id));
  // Deleted photographs disappear from every album; a removed cover needs a new choice.
  return stored.map(album => {
    const photoIds = [...new Set(album.photoIds)].filter(id => available.has(id));
    return { ...album, photoIds, coverPhotoId: album.coverPhotoId && photoIds.includes(album.coverPhotoId) ? album.coverPhotoId : null };
  }).sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export async function saveAlbum(input: unknown, edit: boolean) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ContentError('Check the album details.');
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some(key => !['id', 'name', 'photoIds', 'coverPhotoId'].includes(key)) || typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 100 || !Array.isArray(value.photoIds) || value.photoIds.length > 5000 || !value.photoIds.every(id => typeof id === 'string' && idPattern.test(id))) throw new ContentError('Check the album name and photographs.');
  const posts = await listPosts(), available = new Set(posts.filter(post => post.kind === 'photo' && post.image_key).map(post => post.id));
  const photoIds = [...new Set(value.photoIds as string[])];
  if (photoIds.some(id => !available.has(id))) throw new ContentError('A photograph is no longer available. Reload the editor.');
  const coverPhotoId = value.coverPhotoId;
  if (photoIds.length ? typeof coverPhotoId !== 'string' || !photoIds.includes(coverPhotoId) : coverPhotoId !== null) throw new ContentError('Choose an album photograph as the cover.');
  const albums = await listAlbums(posts), old = edit ? albums.find(album => album.id === value.id) : null;
  if (edit && !old) throw new ContentError('This album is no longer available.', 404);
  const now = new Date().toISOString();
  const album: Album = { id: old?.id ?? randomUUID(), name: value.name.trim(), photoIds, coverPhotoId: coverPhotoId as string | null, created_at: old?.created_at ?? now, updated_at: now };
  await writeContentFile('albums.json', [album, ...albums.filter(item => item.id !== album.id)]);
  return album;
}
export async function deleteAlbum(id: unknown) {
  if (typeof id !== 'string' || !idPattern.test(id)) throw new ContentError('Choose a valid album.');
  const albums = await listAlbums();
  if (!albums.some(album => album.id === id)) throw new ContentError('This album is no longer available.', 404);
  await writeContentFile('albums.json', albums.filter(album => album.id !== id));
}
