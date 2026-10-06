const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const sharp = require('sharp');
const { createImagePreviews } = require('../lib/image-previews.cjs');

test('image previews preserve originals, orientation, and bounded cached conversions', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jerry-preview-test-'));
  t.after(async () => {
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('jerry-preview-test-'));
    await fs.rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  const dataDir = path.join(directory, 'data'), publicDir = path.join(directory, 'public');
  await fs.mkdir(path.join(dataDir, 'images'), { recursive: true });
  await fs.mkdir(path.join(publicDir, 'gallery'), { recursive: true });
  const key = randomUUID(), seedKey = randomUUID();
  const original = await sharp({ create: { width: 400, height: 200, channels: 3, background: '#239' } })
    .withMetadata({ orientation: 6 }).jpeg().toBuffer();
  await fs.writeFile(path.join(dataDir, 'images', key), original);
  await sharp({ create: { width: 80, height: 40, channels: 3, background: '#eb5' } }).webp()
    .toFile(path.join(publicDir, 'gallery', 'seed.webp'));
  const previews = createImagePreviews({ dataDir, publicDir, seedAssets: [{ post: { image_key: seedKey }, image: 'gallery/seed.webp' }] });

  await t.test('concurrent first requests share a complete preview and do not alter the original', async () => {
    const results = await Promise.all(Array.from({ length: 24 }, () => previews.get(key, 'preview')));
    assert.ok(results.every(file => file.path === results[0].path && file.bytes === results[0].bytes));
    assert.deepEqual(await fs.readFile(path.join(dataDir, 'images', key)), original);
    const full = await previews.get(key);
    assert.equal(full.contentType, 'image/jpeg');
    assert.deepEqual(await fs.readFile(full.path), original);
    assert.notEqual(full.etag, results[0].etag);
    assert.equal((await sharp(results[0].path).metadata()).height, 400);
  });
  await t.test('thumbnails respect EXIF rotation, dimensions, and never enlarge small images', async () => {
    const thumb = await previews.get(key, 'thumb'), info = await sharp(thumb.path).metadata();
    assert.equal(info.width, 160); assert.equal(info.height, 320); assert.equal(info.format, 'webp');
    const seed = await previews.get(seedKey, 'preview'), seedInfo = await sharp(seed.path).metadata();
    assert.equal(seedInfo.width, 80); assert.equal(seedInfo.height, 40);
    assert.notEqual(thumb.etag, (await previews.get(key, 'preview')).etag);
  });
  await t.test('warm cache hits reuse existing files and leave no temporary files', async () => {
    const file = await previews.get(key, 'thumb'), before = await fs.stat(file.path);
    await Promise.all(Array.from({ length: 8 }, () => previews.get(key, 'thumb')));
    assert.equal((await fs.stat(file.path)).mtimeMs, before.mtimeMs);
    assert.ok((await fs.readdir(path.dirname(file.path))).every(name => name.endsWith('.webp')));
  });
  await t.test('missing files, path traversal, and unsupported resize presets are rejected', async () => {
    await assert.rejects(previews.get(randomUUID(), 'thumb'), { code: 'ENOENT' });
    await assert.rejects(previews.get('../posts.json', 'preview'), { code: 'ENOENT' });
    await assert.rejects(previews.get(key, '10000'), { code: 'EINVAL' });
    assert.deepEqual(await fs.readFile(path.join(dataDir, 'images', key)), original);
  });
});
