const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const { randomUUID } = require('node:crypto');
const { createImagePreviews, IMAGE_PREVIEW_VERSION } = require('../lib/image-previews.cjs');

async function main() {
  const root = path.resolve(__dirname, '..');
  const dataDir = path.resolve(process.env.JERRY_DATA_DIR || path.join(root, 'data'));
  for (const [source, target, size] of [
    ['public/profile.jpg', 'public/profile.webp', 640],
    ['public/about-portrait.png', 'public/about-portrait.webp', 1086],
    ['public/music-recordings/piano/shang-xin-cover.png', 'public/music-recordings/piano/shang-xin-cover.webp', 1280],
  ]) {
    const input = path.join(root, source), output = path.join(root, target);
    const sourceInfo = await fs.stat(input);
    let outputInfo;
    try { outputInfo = await fs.stat(output); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (outputInfo?.size && outputInfo.mtimeMs >= sourceInfo.mtimeMs) continue;
    const temporary = output + '.' + randomUUID() + '.tmp';
    try {
      await sharp(input).rotate().resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 88, effort: 4 }).toFile(temporary);
      await fs.rename(temporary, output);
    } finally { await fs.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  }
  const assets = require('../lib/gallery-photos.json');
  let posts;
  try { posts = JSON.parse(await fs.readFile(path.join(dataDir, 'posts.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; posts = assets.map(asset => asset.post); }
  const images = createImagePreviews({ dataDir, publicDir: path.join(root, 'public'), seedAssets: assets });
  const keys = [...new Set(posts.filter(post => post.kind === 'photo' && post.image_key && !post.demo).map(post => post.image_key))];
  const manifest = { version: IMAGE_PREVIEW_VERSION, images: {} };
  let cursor = 0;
  let originalBytes = 0, thumbBytes = 0, previewBytes = 0;
  async function worker() {
    while (cursor < keys.length) {
      const key = keys[cursor++];
      const [original, thumb, preview] = await Promise.all([
        images.get(key), images.get(key, 'thumb'), images.get(key, 'preview'),
      ]);
      const [fullInfo, thumbInfo, previewInfo] = await Promise.all([
        sharp(original.path).metadata(), sharp(thumb.path).metadata(), sharp(preview.path).metadata(),
      ]);
      const oriented = fullInfo.autoOrient || fullInfo;
      manifest.images[key] = {
        width: oriented.width, height: oriented.height,
        thumb: { width: thumbInfo.width, height: thumbInfo.height },
        preview: { width: previewInfo.width, height: previewInfo.height },
      };
      originalBytes += original.bytes; thumbBytes += thumb.bytes; previewBytes += preview.bytes;
    }
  }
  await Promise.all([worker(), worker()]);
  const directory = path.join(dataDir, 'image-previews');
  await fs.mkdir(directory, { recursive: true });
  const temporary = path.join(directory, 'manifest.' + randomUUID() + '.tmp');
  await fs.writeFile(temporary, JSON.stringify(manifest) + '\n');
  await fs.rename(temporary, path.join(directory, 'manifest.json'));
  console.log(JSON.stringify({ photos: keys.length, originalBytes, thumbBytes, previewBytes }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
