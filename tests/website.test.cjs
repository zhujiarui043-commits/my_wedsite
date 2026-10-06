const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');
const { createPreviewRelay } = require('../scripts/share-preview.cjs');

test('website content and anonymous interactions work without the desktop editor', { timeout: 90000 }, async t => {
  const root = path.resolve(__dirname, '..'), website = path.join(root, '.next/standalone');
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'jerry-website-test-'));
  let server, relay, logs = '';
  t.after(async () => {
    if (relay) { relay.closeAllConnections(); await new Promise(resolve => relay.close(resolve)); }
    if (server && server.exitCode === null && server.signalCode === null) {
      const exited = new Promise(resolve => server.once('exit', resolve)); server.kill(); await exited;
    }
    const resolved = path.resolve(folder);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('jerry-website-test-'));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  const seeds = require('../lib/gallery-photos.json').map(asset => asset.post);
  const featured = { ...seeds[0], title: 'Featured fixture', featured: true };
  const albumOnly = { ...seeds[1], title: 'Album-only fixture', featured: false };
  const essay = { id: randomUUID(), kind: 'journal', title: 'Existing essay', body: 'These words are still available.', image_key: null, taken_at: '2026-10-06', location: '', created_at: '2026-10-06T00:00:00.000Z', updated_at: '2026-10-06T00:00:00.000Z' };
  const posts = [featured, albumOnly, essay];
  const album = { id: randomUUID(), name: 'Concert collection', photoIds: [featured.id, albumOnly.id], coverPhotoId: albumOnly.id, coverPosition: { x: 50, y: 100 }, created_at: '2026-10-06T00:00:00.000Z', updated_at: '2026-10-06T00:00:00.000Z' };
  const other = { ...album, id: randomUUID(), name: 'Shared collection', photoIds: [featured.id], coverPhotoId: featured.id, coverPosition: { x: 50, y: 50 } };
  const empty = { ...album, id: randomUUID(), name: 'Future collection', photoIds: [], coverPhotoId: null };
  const albums = [album, other, empty];
  await fs.writeFile(path.join(folder, 'posts.json'), JSON.stringify(posts));
  await fs.writeFile(path.join(folder, 'albums.json'), JSON.stringify(albums));
  const probe = net.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [path.join(website, 'server.js')], { cwd: website, windowsHide: true, env: { ...process.env, HOSTNAME: '127.0.0.1', PORT: String(port), JERRY_DATA_DIR: folder }, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', chunk => { logs += chunk; }); server.stderr.on('data', chunk => { logs += chunk; });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { const response = await fetch(origin + '/gallery', { signal: AbortSignal.timeout(1000) }); if (response.ok) { await response.arrayBuffer(); ready = true; break; } } catch {}
    assert.equal(server.exitCode, null, logs); await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready, logs);
  async function markup(route, address = origin) {
    const response = await fetch(address + route); assert.equal(response.status, 200, route); return response.text();
  }
  await t.test('every page uses About, Gallery, Journey, Music, Guestbook in that order', async () => {
    for (const route of ['/', '/about', '/gallery', '/journey', '/journey/shanghai', '/music', '/notes', `/notes/${essay.id}`, `/gallery/albums/${album.id}`, '/moments']) {
      const html = await markup(route);
      const nav = html.match(/<nav[^>]*aria-label="(?:Explore my space|Main navigation)"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
      assert.ok(nav, route);
      assert.deepEqual([...nav.matchAll(/href="([^"]+)"/g)].map(match => match[1]), ['/about', '/gallery', '/journey', '/music', '/notes'], route);
      assert.ok(!html.includes('href="/studio"'), route);
    }
  });
  await t.test('covers retain their framing; album photographs and existing essays remain accessible', async () => {
    const gallery = await markup('/gallery');
    assert.match(gallery, /Concert collection cover/); assert.match(gallery, /object-position:50% 100%/);
    assert.match(gallery, /Like Featured fixture \(0 likes\)/);
    assert.ok(!gallery.includes('Like Album-only fixture (0 likes)'));
    const detail = await markup(`/gallery/albums/${album.id}`);
    assert.match(detail, /Featured fixture/); assert.match(detail, /Album-only fixture/);
    assert.match(await markup(`/gallery/albums/${empty.id}`), /No photographs yet/);
    assert.match(await markup(`/notes/${essay.id}`), /These words are still available/);
    for (const photo of [featured, albumOnly]) assert.equal((await fetch(origin + `/api/images/${photo.image_key}`)).status, 200);
    assert.equal((await fetch(origin + `/gallery/albums/${randomUUID()}`)).status, 404);
  });
  await t.test('one photo keeps the same likes on the planet and in multiple albums', async () => {
    const state = await fetch(origin + '/api/gallery/likes'), cookie = state.headers.get('set-cookie').split(';')[0]; await state.arrayBuffer();
    const liked = await fetch(origin + '/api/gallery/likes', { method: 'POST', headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: featured.id, liked: true }) });
    assert.equal(liked.status, 200); assert.equal((await liked.json()).count, 1);
    for (const route of ['/gallery', `/gallery/albums/${album.id}`, `/gallery/albums/${other.id}`]) assert.match(await markup(route), /Like Featured fixture \(1 like\)/);
  });
  await t.test('previews support conditional GET and HEAD while full-resolution originals stay available', async () => {
    const image = '/api/images/' + featured.image_key;
    const thumb = await fetch(origin + image + '?size=thumb&v=1');
    assert.equal(thumb.status, 200);
    assert.equal(thumb.headers.get('content-type'), 'image/webp');
    const bytes = await thumb.arrayBuffer(), etag = thumb.headers.get('etag');
    assert.equal(bytes.byteLength, Number(thumb.headers.get('content-length')));
    const head = await fetch(origin + image + '?size=thumb&v=1', { method: 'HEAD' });
    assert.equal(head.status, 200); assert.equal((await head.arrayBuffer()).byteLength, 0);
    assert.equal(head.headers.get('etag'), etag);
    const cached = await fetch(origin + image + '?size=thumb&v=1', { headers: { 'If-None-Match': etag } });
    assert.equal(cached.status, 304); assert.equal((await cached.arrayBuffer()).byteLength, 0);
    const full = await fetch(origin + image);
    assert.equal(full.status, 200); assert.notEqual(full.headers.get('etag'), etag);
    assert.ok((await full.arrayBuffer()).byteLength > bytes.byteLength);
    assert.equal((await fetch(origin + image + '?size=10000')).status, 400);
    assert.equal((await fetch(origin + '/api/images/' + randomUUID() + '?size=thumb')).status, 404);
    const music = await markup('/music');
    assert.match(music, /Piano Recordings/);
    assert.ok(!music.includes('<video'), 'Closed recording sections must not mount video players.');
  });
  await t.test('former editor and all editing endpoints are unavailable without altering saved content', async () => {
    const before = await Promise.all(['posts.json', 'albums.json'].map(name => fs.readFile(path.join(folder, name))));
    for (const route of ['/studio', '/api/posts', '/api/albums', '/api/destinations', '/api/gallery/featured', '/api/guestbook/moderate']) {
      for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
        const response = await fetch(origin + route, { method, headers: { Origin: origin, 'Content-Type': 'application/json' }, ...(method !== 'GET' ? { body: JSON.stringify({ id: featured.id }) } : {}) });
        assert.equal(response.status, 404, `${method} ${route}`); await response.arrayBuffer();
      }
    }
    assert.deepEqual(await Promise.all(['posts.json', 'albums.json'].map(name => fs.readFile(path.join(folder, name)))), before);
  });
  await t.test('friends can open albums, cover images, and Guestbook through the preview', async () => {
    relay = createPreviewRelay(port, { readPosts: () => posts, readAlbums: () => albums });
    await new Promise(resolve => relay.listen(0, '127.0.0.1', resolve));
    const address = `http://127.0.0.1:${relay.address().port}`;
    assert.match(await markup(`/gallery/albums/${album.id}`, address), /Album-only fixture/);
    assert.equal((await fetch(address + `/api/images/${albumOnly.image_key}`)).status, 200);
    assert.match(await markup('/notes', address), /Leave a little hello/);
    assert.equal((await fetch(address + '/api/guestbook')).status, 200);
    assert.equal((await fetch(address + '/studio')).status, 404);
  });
});
