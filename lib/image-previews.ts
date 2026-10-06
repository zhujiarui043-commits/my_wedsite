import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { createImagePreviews } from './image-previews.cjs';
import assets from './gallery-photos.json';
import { dataRoot } from './content-storage';

export const imagePreviews = createImagePreviews({
  dataDir: dataRoot, publicDir: path.join(process.cwd(), 'public'), seedAssets: assets,
});
type PreviewMetadata = {
  width: number; height: number;
  thumb: { width: number; height: number };
  preview: { width: number; height: number };
};
let cached: Record<string, PreviewMetadata> = {};
let modified = -1;

export async function previewMetadata(): Promise<Record<string, PreviewMetadata>> {
  const filename = path.join(dataRoot, 'image-previews', 'manifest.json');
  try {
    const info = await stat(filename);
    if (info.mtimeMs !== modified) {
      cached = JSON.parse(await readFile(filename, 'utf8')).images;
      modified = info.mtimeMs;
    }
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  return cached;
}
