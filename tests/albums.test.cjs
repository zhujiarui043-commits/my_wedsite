const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { createPreviewRelay } = require('../scripts/share-preview.cjs');

test('Studio albums publish covers and photographs without losing the planet or likes', { timeout: 90000 }, async t => {
  const root = path.resolve(__dirname, '..');
  const latest = JSON.parse(await fs.readFile(path.join(root, 'dist-desktop/latest.json'), 'utf8'));
  const website = path.join(latest.directory, 'resources/website');
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'jerry-albums-test-'));
  const children = []; let relay;
  async function stop(child) {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exited;
  }
  t.after(async () => {
    if (relay) { relay.closeAllConnections(); await new Promise(resolve => relay.close(resolve)); }
    await Promise.all(children.map(stop));
    const resolved = path.resolve(folder);
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('jerry-albums-test-')) await fs.rm(resolved, { recursive: true, force: true });
  });
  async function start() {
    const probe = net.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
    const origin = `http://127.0.0.1:${port}`; let logs = '';
    const child = spawn(process.execPath, [path.join(website, 'server.js')], { cwd: website, windowsHide: true, env: { ...process.env, HOSTNAME: '127.0.0.1', PORT: String(port), JERRY_DATA_DIR: folder }, stdio: ['ignore', 'pipe', 'pipe'] }); children.push(child);
    child.stdout.on('data', chunk => { logs += chunk; }); child.stderr.on('data', chunk => { logs += chunk; });
    for (let i = 0; i < 60; i++) {
      try { const response = await fetch(origin + '/api/albums', { signal: AbortSignal.timeout(1000) }); if (response.ok) { await response.arrayBuffer(); return { child, origin }; } } catch {}
      assert.equal(child.exitCode, null, logs); await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.fail(logs);
  }
  let site = await start();
  const seed = require('../lib/gallery-photos.json').map(asset => asset.post);
  async function read(route) { const response = await fetch(site.origin + route); return { status: response.status, data: await response.json() }; }
  async function json(route, method, body, extraHeaders = {}) {
    const response = await fetch(site.origin + route, { method, headers: { Origin: site.origin, 'Content-Type': 'application/json', ...extraHeaders }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }
  async function upload(title, kind = 'photo') {
    const body = new FormData(); body.set('kind', kind); body.set('title', title); body.set('taken_at', '2026-10-06'); body.set('image', new Blob([await fs.readFile(path.join(root, 'public/profile.jpg'))], { type: 'image/jpeg' }), 'test.jpg');
    const response = await fetch(site.origin + '/api/posts', { method: 'POST', headers: { Origin: site.origin }, body });
    assert.equal(response.status, 200); return (await response.json()).post;
  }
  let one, two, a, b, cookie;
  await t.test('existing highlights are kept; new uploads wait for selection', async () => {
    assert.deepEqual((await read('/api/albums')).data.albums, []);
    a = await upload('Album upload A'); b = await upload('Album upload B');
    assert.equal((await read('/api/posts')).data.posts.length, seed.length + 2);
    assert.equal(a.featured, false); assert.equal(b.featured, false);
    const page = await (await fetch(site.origin + '/gallery')).text();
    assert.ok(page.includes(seed[0].title)); assert.ok(!page.includes('Album upload A')); assert.ok(!page.includes('Album upload B')); assert.match(page, /Albums/);
  });
  await t.test('albums choose their own name, members, and cover; photographs can belong to two albums', async () => {
    const created = await json('/api/albums', 'POST', { name: 'Shanghai memories', photoIds: [seed[0].id, a.id, a.id], coverPhotoId: a.id });
    assert.equal(created.status, 200); one = created.data.album;
    assert.deepEqual(one.photoIds, [seed[0].id, a.id]); assert.equal(one.coverPhotoId, a.id);
    const second = await json('/api/albums', 'POST', { name: 'Weekend', photoIds: [a.id, b.id], coverPhotoId: b.id });
    assert.equal(second.status, 200); two = second.data.album;
    const gallery = await (await fetch(site.origin + '/gallery')).text();
    assert.ok(gallery.includes(`/gallery/albums/${one.id}`)); assert.ok(gallery.includes(`/api/images/${a.image_key}`)); assert.match(gallery, /Shanghai memories cover/);
    const album = await (await fetch(site.origin + `/gallery/albums/${one.id}`)).text();
    assert.match(album, /Shanghai memories/); assert.match(album, /Album upload A/); assert.ok(!album.includes('Album upload B')); assert.match(album, /Back to Gallery/); assert.match(album, /photo-like/);
  });
  await t.test('featuring an album photograph keeps its ID and shares the same likes in every view', async () => {
    const visitor = await fetch(site.origin + '/api/gallery/likes'); cookie = visitor.headers.get('set-cookie').split(';')[0]; await visitor.arrayBuffer();
    assert.equal((await json('/api/gallery/likes', 'POST', { id: a.id, liked: true }, { Cookie: cookie })).data.count, 1);
    const selected = await json('/api/gallery/featured', 'PATCH', { id: a.id, featured: true });
    assert.equal(selected.status, 200); assert.equal(selected.data.post.id, a.id); assert.equal(selected.data.post.image_key, a.image_key); assert.equal(selected.data.post.featured, true);
    assert.equal((await read('/api/posts')).data.posts.length, seed.length + 2);
    const gallery = await (await fetch(site.origin + '/gallery')).text();
    const album = await (await fetch(site.origin + `/gallery/albums/${two.id}`)).text();
    assert.ok(gallery.includes('Like Album upload A (1 like)')); assert.ok(album.includes('Like Album upload A (1 like)'));
    assert.ok(!gallery.includes('Like Album upload B (0 likes)'));
    assert.equal((await json('/api/gallery/likes', 'POST', { id: a.id, liked: true }, { Cookie: cookie })).data.count, 1);
    const another = await fetch(site.origin + '/api/gallery/likes'); const otherCookie = another.headers.get('set-cookie').split(';')[0]; await another.arrayBuffer();
    assert.equal((await json('/api/gallery/likes', 'POST', { id: a.id, liked: true }, { Cookie: otherCookie })).data.count, 2);
    for (const route of ['/gallery', `/gallery/albums/${one.id}`, `/gallery/albums/${two.id}`]) assert.ok((await (await fetch(site.origin + route)).text()).includes('Like Album upload A (2 likes)'));
    assert.equal((await json('/api/gallery/likes', 'POST', { id: a.id, liked: false }, { Cookie: otherCookie })).data.count, 1);
  });
  await t.test('removing a highlight keeps album members, covers, and likes; editing preserves the selection', async () => {
    const result = await json('/api/gallery/featured', 'PATCH', { id: a.id, featured: false }); assert.equal(result.status, 200);
    const gallery = await (await fetch(site.origin + '/gallery')).text();
    assert.ok(!gallery.includes('Like Album upload A (1 like)')); assert.match(gallery, /Shanghai memories cover/);
    const albums = (await read('/api/albums')).data.albums;
    assert.equal(albums.find(item => item.id === one.id).coverPhotoId, a.id); assert.ok(albums.find(item => item.id === two.id).photoIds.includes(a.id));
    assert.equal((await read('/api/gallery/likes')).data.counts[a.id], 1);
    const body = new FormData(); for (const key of ['kind', 'title', 'taken_at', 'body', 'location']) body.set(key, String(a[key] || '')); body.set('id', a.id);
    const edited = await fetch(site.origin + '/api/posts', { method: 'PATCH', headers: { Origin: site.origin }, body });
    assert.equal(edited.status, 200); const updated = (await edited.json()).post; assert.equal(updated.featured, false); assert.equal(updated.image_key, a.image_key);
    assert.equal((await json('/api/gallery/featured', 'PATCH', { id: a.id, featured: true })).status, 200);
    const selectedEdit = await fetch(site.origin + '/api/posts', { method: 'PATCH', headers: { Origin: site.origin }, body }); assert.equal((await selectedEdit.json()).post.featured, true);
    assert.equal((await read('/api/posts')).data.posts.length, seed.length + 2);
  });
  await t.test('removing a member preserves its photograph, other albums, and likes', async () => {
    assert.equal((await json('/api/gallery/likes', 'POST', { id: a.id, liked: true }, { Cookie: cookie })).data.count, 1);
    const edited = await json('/api/albums', 'PATCH', { id: one.id, name: 'Shanghai evenings', photoIds: [seed[0].id], coverPhotoId: seed[0].id });
    assert.equal(edited.status, 200); assert.equal(edited.data.album.created_at, one.created_at); one = edited.data.album;
    assert.equal((await fetch(site.origin + `/api/images/${a.image_key}`)).status, 200);
    const albums = (await read('/api/albums')).data.albums; assert.ok(albums.find(item => item.id === two.id).photoIds.includes(a.id));
    assert.equal((await read('/api/gallery/likes')).data.counts[a.id], 1);
    assert.equal((await read('/api/posts')).data.posts.length, seed.length + 2);
  });
  if (process.platform === 'win32') await t.test('saving survives a brief Windows file lock without deleting the old data', async () => {
    const script = path.join(folder, 'hold-album.ps1');
    await fs.writeFile(script, 'param([string]$FilePath)\n$albumStream = [System.IO.File]::Open($FilePath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)\n[Console]::Out.WriteLine("LOCKED")\nStart-Sleep -Milliseconds 400\n$albumStream.Dispose()\n');
    const holder = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-FilePath', path.join(folder, 'albums.json')], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); children.push(holder);
    await new Promise((resolve, reject) => { holder.once('error', reject); holder.stdout.once('data', resolve); holder.once('exit', code => { if (code) reject(new Error('Could not create the verification file lock')); }); });
    const edited = await json('/api/albums', 'PATCH', { id: one.id, name: one.name, photoIds: one.photoIds, coverPhotoId: one.coverPhotoId });
    assert.equal(edited.status, 200); assert.deepEqual(edited.data.album.photoIds, one.photoIds);
    assert.equal((await read('/api/albums')).data.albums.length, 2);
  });
  await t.test('invalid covers, notes, missing photos, and foreign requests cannot change albums', async () => {
    const note = await upload('Not an album photograph', 'journal');
    const valid = { name: 'Invalid album', photoIds: [a.id], coverPhotoId: a.id };
    assert.equal((await json('/api/albums', 'POST', valid, { Origin: 'https://foreign.example' })).status, 403);
    assert.equal((await json('/api/albums', 'POST', valid, { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await json('/api/albums', 'POST', { ...valid, name: '  ' })).status, 400);
    assert.equal((await json('/api/albums', 'POST', { ...valid, coverPhotoId: b.id })).status, 400);
    assert.equal((await json('/api/albums', 'POST', { ...valid, coverPhotoId: null })).status, 400);
    assert.equal((await json('/api/albums', 'POST', { ...valid, photoIds: [note.id], coverPhotoId: note.id })).status, 400);
    assert.equal((await json('/api/albums', 'POST', { ...valid, photoIds: ['11111111-1111-4111-8111-111111111111'] })).status, 400);
    assert.equal((await read('/api/albums')).data.albums.length, 2);
    assert.equal((await json('/api/gallery/featured', 'PATCH', { id: a.id, featured: false }, { Origin: 'https://foreign.example' })).status, 403);
    assert.equal((await json('/api/gallery/featured', 'PATCH', { id: a.id, featured: false }, { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await json('/api/gallery/featured', 'PATCH', { id: a.id, featured: 'false' })).status, 400);
    assert.equal((await json('/api/gallery/featured', 'PATCH', { id: a.id, featured: false, title: 'Cannot edit' })).status, 400);
    assert.equal((await json('/api/gallery/featured', 'PATCH', { id: note.id, featured: true })).status, 404);
    assert.equal((await json('/api/gallery/featured', 'PATCH', { id: crypto.randomUUID(), featured: true })).status, 404);
    assert.equal((await read('/api/posts')).data.posts.find(photo => photo.id === a.id).featured, true);
  });
  await t.test('albums survive a website restart and are readable through the shared preview', async () => {
    await stop(site.child); site = await start();
    assert.equal((await read('/api/albums')).data.albums.find(item => item.id === one.id).name, 'Shanghai evenings');
    const posts = (await read('/api/posts')).data.posts; assert.equal(posts.find(photo => photo.id === a.id).featured, true); assert.equal(posts.find(photo => photo.id === b.id).featured, false);
    assert.ok((await (await fetch(site.origin + '/gallery')).text()).includes('Like Album upload A (1 like)'));
    relay = createPreviewRelay(Number(new URL(site.origin).port), { readAlbums: () => JSON.parse(require('node:fs').readFileSync(path.join(folder, 'albums.json'), 'utf8')), readPosts: () => JSON.parse(require('node:fs').readFileSync(path.join(folder, 'posts.json'), 'utf8')) });
    await new Promise(resolve => relay.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${relay.address().port}`;
    const response = await fetch(origin + `/gallery/albums/${two.id}`); assert.equal(response.status, 200); assert.match(await response.text(), /Album upload B/);
    assert.equal((await fetch(origin + '/api/albums')).status, 404); assert.equal((await fetch(origin + '/api/albums', { method: 'POST' })).status, 405);
    assert.equal((await fetch(origin + '/api/gallery/featured')).status, 404); assert.equal((await fetch(origin + '/api/gallery/featured', { method: 'PATCH' })).status, 405);
  });
  await t.test('deleting a planet photo removes album references and clears its cover', async () => {
    assert.equal((await json('/api/posts', 'DELETE', { id: b.id })).status, 200);
    const updated = (await read('/api/albums')).data.albums.find(item => item.id === two.id);
    assert.deepEqual(updated.photoIds, [a.id]); assert.equal(updated.coverPhotoId, null);
    assert.equal((await fetch(site.origin + `/api/images/${b.image_key}`)).status, 404);
    assert.match(await (await fetch(site.origin + '/gallery')).text(), /No cover selected/);
  });
  await t.test('deleting an album preserves its photographs and makes its page unavailable', async () => {
    assert.equal((await json('/api/albums', 'DELETE', { id: two.id })).status, 200);
    assert.equal((await fetch(site.origin + `/gallery/albums/${two.id}`)).status, 404);
    assert.equal((await fetch(site.origin + `/api/images/${a.image_key}`)).status, 200);
    assert.equal((await read('/api/gallery/likes')).data.counts[a.id], 1);
    assert.equal((await json('/api/albums', 'DELETE', { id: one.id })).status, 200);
    const empty = await json('/api/albums', 'POST', { name: 'Next journey', photoIds: [], coverPhotoId: null }); assert.equal(empty.status, 200);
    assert.match(await (await fetch(site.origin + `/gallery/albums/${empty.data.album.id}`)).text(), /No photographs yet/);
  });
});
