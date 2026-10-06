import { createHash } from 'node:crypto';
import { mkdir, open, readFile, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { dataRoot, writeContentFile } from './content-storage';
import { listPosts, withWriteLock } from './posts';
import { ContentError } from './editor-image';
import { GALLERY_VISITOR_COOKIE, type GalleryLikeState } from './gallery-likes-shared';

type Votes = Record<string, string[]>;
const votesFile = path.join(dataRoot, 'gallery-likes.json');
const lockFile = path.join(dataRoot, 'gallery-likes.lock');
const visitorHash = (visitor: string) => createHash('sha256').update(visitor).digest('hex');

export function galleryVisitor(request: Request) {
  const cookie = request.headers.get('cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith(`${GALLERY_VISITOR_COOKIE}=`));
  const value = cookie?.slice(GALLERY_VISITOR_COOKIE.length + 1);
  return value && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value) ? value : null;
}
async function readVotes(): Promise<Votes> {
  try {
    const stored = JSON.parse(await readFile(votesFile, 'utf8'));
    if (stored.version !== 1 || !stored.photos || typeof stored.photos !== 'object' || Array.isArray(stored.photos)) throw new Error('Invalid Gallery likes data');
    const entries = Object.entries(stored.photos);
    for (const [, voters] of entries) {
      if (!Array.isArray(voters) || !voters.every(value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value))) throw new Error('Invalid Gallery votes');
    }
    return Object.fromEntries(entries.map(([id, voters]) => [id, [...new Set(voters as string[])]]));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}
export async function galleryLikeCounts() {
  return Object.fromEntries(Object.entries(await readVotes()).map(([id, voters]) => [id, voters.length]));
}
export async function galleryLikeState(visitor: string): Promise<GalleryLikeState> {
  const [posts, votes] = await Promise.all([listPosts(), readVotes()]);
  const photos = posts.filter(post => post.kind === 'photo' && post.image_key), hash = visitorHash(visitor);
  return {
    counts: Object.fromEntries(photos.map(photo => [photo.id, votes[photo.id]?.length || 0])),
    liked: photos.filter(photo => votes[photo.id]?.includes(hash)).map(photo => photo.id),
  };
}
// The file lock also protects votes shared by the local site, desktop app, and preview.
async function lockVotes<T>(operation: () => Promise<T>) {
  await mkdir(dataRoot, { recursive: true });
  for (let attempt = 0; attempt < 120; attempt++) {
    let lock;
    try { lock = await open(lockFile, 'wx'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      try { if (Date.now() - (await stat(lockFile)).mtimeMs > 60000) await unlink(lockFile); }
      catch (problem) { if ((problem as NodeJS.ErrnoException).code !== 'ENOENT') throw problem; }
      await new Promise(resolve => setTimeout(resolve, 50));
      continue;
    }
    try { return await operation(); }
    finally { await lock.close(); await unlink(lockFile).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  }
  throw new ContentError('Likes are busy. Please try again.', 503);
}
export async function setGalleryLike(id: string, visitor: string, liked: boolean) {
  return withWriteLock(() => lockVotes(async () => {
    const photo = (await listPosts()).find(post => post.id === id && post.kind === 'photo' && post.image_key);
    if (!photo) throw new ContentError('This photograph is no longer available.', 404);
    const votes = await readVotes(), hash = visitorHash(visitor), voters = new Set(votes[id] || []);
    if (liked) voters.add(hash); else voters.delete(hash);
    if (voters.size) votes[id] = [...voters]; else delete votes[id];
    await writeContentFile('gallery-likes.json', { version: 1, photos: votes });
    return { id, count: voters.size, liked };
  }));
}
