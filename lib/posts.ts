import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { dataRoot, writeContentFile } from './content-storage';
import type { Post } from './post-shared';
import { seedPhotos, galleryAsset } from './seed-gallery';
export type { Post } from './post-shared';

const root = dataRoot;
const postsFile = path.join(root, 'posts.json');
const imagesDir = path.join(root, 'images');
// Share the write queue across server modules and development reloads.
const shared = globalThis as typeof globalThis & { journalWrites?: Promise<unknown> };
export function withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const pending = (shared.journalWrites ?? Promise.resolve()).then(operation);
  shared.journalWrites = pending.catch(() => undefined);
  return pending;
}
export async function listPosts(): Promise<Post[]> {
  try {
    const posts: Post[] = JSON.parse(await readFile(postsFile, 'utf8'));
    if (!Array.isArray(posts)) throw new Error('Invalid posts data');
    return posts.sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [...seedPhotos];
    throw error;
  }
}
export async function writePosts(posts: Post[]) {
  await writeContentFile('posts.json', posts);
}
function imagePath(key: string) {
  if (!/^[a-f0-9-]{36}$/.test(key)) throw new Error('Invalid image key');
  return path.join(imagesDir, key);
}
export function bucket() {
  return {
    async put(key: string, bytes: ArrayBuffer, _metadata: unknown) {
      await mkdir(imagesDir, { recursive: true });
      await writeFile(imagePath(key), new Uint8Array(bytes), { flag: 'wx' });
    },
    async delete(key: string) {
      try { await unlink(imagePath(key)); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    },
    async get(key: string) {
      try {
        let bytes;
        try { bytes = await readFile(imagePath(key)); }
        catch (error) {
          const asset = galleryAsset(key);
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || !asset) throw error;
          bytes = await readFile(path.join(process.cwd(), 'public', asset.image));
        }
        const contentType = bytes[0] === 255 ? 'image/jpeg' : bytes[0] === 137 ? 'image/png' : 'image/webp';
        return {
          body: new Uint8Array(bytes),
          httpEtag: `"${key}"`,
          writeHttpMetadata(headers: Headers) { headers.set('content-type', contentType); },
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
    },
  };
}
