const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const sharp = require('sharp');
// Do not retain open source files in libvips' cache on Windows.
sharp.cache({ files: 0 });

const IMAGE_PREVIEW_VERSION = 1;
const PRESETS = { thumb: 320, preview: 960 };

/** @param {{dataDir: string, publicDir: string, seedAssets?: Array<{post: {image_key: string}, image: string}>}} options */
function createImagePreviews({ dataDir, publicDir, seedAssets = [] }) {
  const assets = new Map(seedAssets.map(asset => [asset.post.image_key, asset]));
  const directory = path.join(dataDir, 'image-previews', 'v' + IMAGE_PREVIEW_VERSION);
  const pending = new Map();
  const queue = [];
  let active = 0;
  function drain() {
    while (active < 2 && queue.length) { active++; queue.shift()(); }
  }
  function limited(operation) {
    return new Promise((resolve, reject) => {
      queue.push(async () => {
        try { resolve(await operation()); }
        catch (error) { reject(error); }
        finally { active--; drain(); }
      });
      drain();
    });
  }
  async function source(key) {
    let filename = path.join(dataDir, 'images', key);
    let metadata;
    try { metadata = await fs.stat(filename); }
    catch (error) {
      const asset = assets.get(key);
      if (error.code !== 'ENOENT' || !asset) throw error;
      filename = path.join(publicDir, asset.image);
      metadata = await fs.stat(filename);
    }
    return { path: filename, bytes: metadata.size };
  }
  async function get(key, size = 'original') {
    if (!/^[a-f0-9-]{36}$/.test(key)) throw Object.assign(new Error('Invalid image key'), { code: 'ENOENT' });
    if (size === 'original') {
      const file = await source(key);
      const handle = await fs.open(file.path, 'r');
      const header = Buffer.alloc(12);
      try { await handle.read(header, 0, header.length, 0); }
      finally { await handle.close(); }
      const contentType = header[0] === 255 ? 'image/jpeg' : header[0] === 137 ? 'image/png' : 'image/webp';
      return { ...file, contentType, etag: '"' + key + '"' };
    }
    if (!Object.hasOwn(PRESETS, size)) throw Object.assign(new Error('Invalid preview size'), { code: 'EINVAL' });
    const filename = path.join(directory, key + '-' + size + '.webp');
    const result = () => fs.stat(filename).then(metadata => ({
      path: filename, bytes: metadata.size, contentType: 'image/webp',
      etag: '"' + key + '-' + size + '-v' + IMAGE_PREVIEW_VERSION + '"',
    }));
    try { return await result(); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const cacheKey = key + ':' + size;
    if (!pending.has(cacheKey)) {
      const task = limited(async () => {
        try { return await result(); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        const original = await source(key);
        await fs.mkdir(directory, { recursive: true });
        const temporary = filename + '.' + randomUUID() + '.tmp';
        try {
          await sharp(original.path).rotate().resize({
            width: PRESETS[size], height: PRESETS[size], fit: 'inside', withoutEnlargement: true,
          }).webp({ quality: size === 'thumb' ? 80 : 85, effort: 4 }).toFile(temporary);
          await fs.rename(temporary, filename);
        } finally { await fs.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
        return result();
      });
      pending.set(cacheKey, task);
      task.then(() => pending.delete(cacheKey), () => pending.delete(cacheKey));
    }
    return pending.get(cacheKey);
  }
  return { get };
}

module.exports = { createImagePreviews, IMAGE_PREVIEW_VERSION };
