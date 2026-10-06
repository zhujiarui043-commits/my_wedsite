const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');

async function unusedPort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  return port;
}
test('desktop website publishes, reads, edits, and deletes all three content types', { timeout: 90000 }, async t => {
  const root = path.resolve(__dirname, '..');
  const latest = JSON.parse(await fs.readFile(path.join(root, 'dist-desktop', 'latest.json'), 'utf8'));
  const website = path.join(latest.directory, 'resources', 'website');
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'jerry-studio-test-'));
  const origin = `http://127.0.0.1:${await unusedPort()}`;
  let logs = '';
  const server = spawn(process.execPath, [path.join(website, 'server.js')], { cwd: website, windowsHide: true, env: { ...process.env, HOSTNAME: '127.0.0.1', PORT: new URL(origin).port, JERRY_DATA_DIR: folder }, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', data => { logs += data; }); server.stderr.on('data', data => { logs += data; });
  t.after(async () => {
    if (server.exitCode === null) { server.kill(); await new Promise(resolve => server.once('exit', resolve)); }
    const resolved = path.resolve(folder);
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('jerry-studio-test-')) await fs.rm(resolved, { recursive: true, force: true });
  });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { const result = await fetch(`${origin}/api/posts`, { signal: AbortSignal.timeout(1000) }); if (result.ok) { ready = true; break; } } catch {}
    if (server.exitCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready, logs);
  async function formRequest(route, method, fields, image) {
    const body = new FormData(); for (const [key, value] of Object.entries(fields)) body.set(key, String(value));
    if (image) body.set('image', new Blob([image], { type: 'image/jpeg' }), 'test.jpg');
    const result = await fetch(origin + route, { method, headers: { Origin: origin }, body });
    return { status: result.status, data: await result.json() };
  }
  async function remove(route, value) {
    const result = await fetch(origin + route, { method: 'DELETE', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
    assert.equal(result.status, 200);
  }
  const photo = await fs.readFile(path.join(root, 'public', 'profile.jpg'));
  const seedPhotos = require('../lib/gallery-photos.json').map(asset => asset.post);
  let note, gallery, destination;
  await t.test('existing destination order, supplied Gallery photos, and empty Notes are preserved', async () => {
    const entries = await (await fetch(`${origin}/api/destinations`)).json();
    assert.deepEqual(entries.destinations.map(entry => entry.slug), ['yancheng', 'shanghai', 'osaka', 'hong-kong', 'macao', 'changchun', 'liaoning', 'yushan-island', 'jiande']);
    assert.match(await (await fetch(`${origin}/notes`)).text(), /No notes yet/);
    const galleryPage = await (await fetch(`${origin}/gallery`)).text();
    assert.match(galleryPage, /Interactive photo sphere/);
    assert.ok(galleryPage.includes(seedPhotos[0].title));
    assert.equal((await fetch(`${origin}/api/images/${seedPhotos[0].image_key}`)).status, 200);
  });
  await t.test('a note can be published with a photo, read, edited, and have its photo removed', async () => {
    const created = await formRequest('/api/posts', 'POST', { kind: 'journal', title: 'Verification note', body: 'First paragraph.\n\n第二段文字。\nA new line.', taken_at: '2026-10-06', location: 'Shanghai' }, photo);
    assert.equal(created.status, 200); note = created.data.post;
    assert.ok(!note.body.includes('\r'));
    const page = await (await fetch(`${origin}/notes/${note.id}`)).text();
    assert.match(page, /First paragraph/); assert.match(page, /第二段文字/); assert.ok(page.includes(`/api/images/${note.image_key}`));
    assert.equal((await fetch(`${origin}/api/images/${note.image_key}`)).headers.get('content-type'), 'image/jpeg');
    const edited = await formRequest('/api/posts', 'PATCH', { ...note, title: 'Edited note', remove_image: 'true' });
    assert.equal(edited.status, 200); assert.equal(edited.data.post.image_key, null); assert.equal(edited.data.post.created_at, note.created_at);
    assert.equal((await fetch(`${origin}/api/images/${note.image_key}`)).status, 404);
    assert.match(await (await fetch(`${origin}/notes`)).text(), /Edited note/);
  });
  await t.test('Gallery displays published photos and updated captions', async () => {
    const created = await formRequest('/api/posts', 'POST', { kind: 'photo', title: 'Verification photograph', body: 'Photo caption', taken_at: '2026-10-06', location: 'Shanghai', featured: true }, photo);
    assert.equal(created.status, 200); gallery = created.data.post;
    const html = await (await fetch(`${origin}/gallery`)).text(); assert.match(html, /Verification photograph/); assert.ok(html.includes(`/api/images/${gallery.image_key}`));
    const edited = await formRequest('/api/posts', 'PATCH', { ...gallery, title: 'Edited photograph', body: 'New caption' });
    assert.equal(edited.status, 200); assert.equal(edited.data.post.image_key, gallery.image_key);
  });
  await t.test('new destinations get a page, text, photo, and map dot without rebuilding', async () => {
    const created = await formRequest('/api/destinations', 'POST', { slug: 'verification-chengdu', name: 'Verification Chengdu', region: 'Sichuan', body: 'A travel paragraph.\n\nAnother paragraph.', country: 'CHN', longitude: '104.0665', latitude: '30.5723' }, photo);
    assert.equal(created.status, 200); destination = created.data.destination;
    assert.match(await (await fetch(`${origin}/journey`)).text(), /Verification Chengdu/);
    const page = await (await fetch(`${origin}/journey/${destination.slug}`)).text(); assert.match(page, /A travel paragraph/); assert.ok(page.includes(`/api/images/${destination.image_key}`));
    const edited = await formRequest('/api/destinations', 'PATCH', { ...destination, body: 'Edited travel journal', remove_image: 'true' });
    assert.equal(edited.status, 200); assert.equal(edited.data.destination.image_key, null);
    assert.equal((await fetch(`${origin}/api/images/${destination.image_key}`)).status, 404);
    assert.match(await (await fetch(`${origin}/journey/${destination.slug}`)).text(), /Edited travel journal/);
  });
  await t.test('validation and origin restrictions prevent invalid or foreign writes', async () => {
    const foreign = await fetch(`${origin}/api/posts`, { method: 'POST', headers: { Origin: 'https://example.com' } }); assert.equal(foreign.status, 403);
    const noOrigin = await fetch(`${origin}/api/destinations`, { method: 'POST' }); assert.equal(noOrigin.status, 403);
    const missingPhoto = await formRequest('/api/posts', 'POST', { kind: 'photo', title: 'No image', taken_at: '2026-10-06' }); assert.equal(missingPhoto.status, 400);
    const badDate = await formRequest('/api/posts', 'POST', { kind: 'journal', title: 'Bad date', taken_at: '2026-02-30' }); assert.equal(badDate.status, 400);
    const badCoordinates = await formRequest('/api/destinations', 'POST', { slug: 'invalid', name: 'Invalid', latitude: '30' }); assert.equal(badCoordinates.status, 400);
    const duplicate = await formRequest('/api/destinations', 'POST', { slug: destination.slug, name: 'Duplicate' }); assert.equal(duplicate.status, 409);
    const removeRequired = await formRequest('/api/posts', 'PATCH', { ...gallery, remove_image: 'true' }); assert.equal(removeRequired.status, 400);
    assert.equal((await fetch(`${origin}/api/images/${gallery.image_key}`)).status, 200);
  });
  await t.test('deleting entries removes their public pages and uploaded files', async () => {
    await remove('/api/posts', { id: note.id }); await remove('/api/posts', { id: gallery.id }); await remove('/api/destinations', { slug: destination.slug });
    assert.equal((await fetch(`${origin}/notes/${note.id}`)).status, 404);
    assert.equal((await fetch(`${origin}/journey/${destination.slug}`)).status, 404);
    assert.equal((await fetch(`${origin}/api/images/${gallery.image_key}`)).status, 404);
    assert.deepEqual((await (await fetch(`${origin}/api/posts`)).json()).posts.map(post => post.id).sort(), seedPhotos.map(post => post.id).sort());
    assert.equal((await fs.readdir(path.join(folder, 'images'))).length, 0);
  });
});
