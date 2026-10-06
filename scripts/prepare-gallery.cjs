const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const sharp = require('sharp');

function stableId(prefix, bytes) {
  const value = createHash('sha256').update(prefix).update(bytes).digest('hex').slice(0, 32);
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-4${value.slice(13, 16)}-8${value.slice(17, 20)}-${value.slice(20)}`;
}
async function main() {
  const root = path.resolve(__dirname, '..');
  const input = path.join(root, 'photos');
  const output = path.join(root, 'public', 'gallery');
  const manifest = path.join(root, 'lib', 'gallery-photos.json');
  let previous = [];
  try { previous = JSON.parse(await fs.readFile(manifest, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const existing = new Map(previous.map(entry => [entry.post.image_key, entry]));
  let nextNumber = Math.max(0, ...previous.map(entry => Number(entry.post.title.match(/^Photograph (\d+)$/)?.[1]) || 0));
  const files = (await fs.readdir(input)).filter(name => /\.(jpe?g|png|webp)$/i.test(name)).sort();
  if (!files.length) throw new Error('Add photographs to the photos folder first.');
  await fs.mkdir(output, { recursive: true });
  const entries = [];
  const seen = new Set();
  let added = 0;
  const now = new Date().toISOString();
  for (const filename of files) {
    const bytes = await fs.readFile(path.join(input, filename));
    const key = stableId('gallery-image:', bytes);
    if (seen.has(key)) continue;
    seen.add(key);
    const full = `${key}.webp`, thumbnail = `${key}-thumb.webp`;
    const cached = existing.get(key);
    if (cached) {
      try {
        await fs.access(path.join(output, full));
        await fs.access(path.join(output, thumbnail));
        entries.push(cached);
        continue;
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const result = await sharp(bytes).rotate().resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true }).webp({ quality: 92 }).toFile(path.join(output, full));
    await sharp(bytes).rotate().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 86 }).toFile(path.join(output, thumbnail));
    entries.push({
      post: cached?.post || { id: stableId('gallery-post:', bytes), kind: 'photo', title: `Photograph ${String(++nextNumber).padStart(2, '0')}`, body: '', image_key: key, location: '', taken_at: '', created_at: now, updated_at: now },
      image: `gallery/${full}`, thumbnail: `/gallery/${thumbnail}`, width: result.width, height: result.height,
    });
    if (!cached) added++;
  }
  await fs.writeFile(manifest, JSON.stringify(entries, null, 2) + '\n');
  console.log(`Gallery now contains ${entries.length} photographs (${added} added). Originals in photos were preserved.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
