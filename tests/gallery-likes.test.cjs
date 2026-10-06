const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { createPreviewRelay } = require('../scripts/share-preview.cjs');

async function stop(server) {
  if (server.exitCode !== null || server.signalCode !== null) return;
  const exited = new Promise(resolve => server.once('exit', resolve));
  server.kill(); await exited;
}
test('Gallery votes persist, deduplicate, and work through the preview', { timeout: 90000 }, async t => {
  const root = path.resolve(__dirname, '..');
  const latest = JSON.parse(await fs.readFile(path.join(root, 'dist-desktop/latest.json'), 'utf8'));
  const website = path.join(latest.directory, 'resources/website');
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'jerry-likes-test-'));
  const children = []; let relay;
  t.after(async () => {
    if (relay) { relay.closeAllConnections(); await new Promise(resolve => relay.close(resolve)); }
    await Promise.all(children.map(stop));
    const resolved = path.resolve(folder);
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('jerry-likes-test-')) await fs.rm(resolved, { recursive: true, force: true });
  });
  async function start() {
    const probe = net.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
    const origin = `http://127.0.0.1:${port}`; let logs = '';
    const server = spawn(process.execPath, [path.join(website, 'server.js')], { cwd: website, windowsHide: true, env: { ...process.env, HOSTNAME: '127.0.0.1', PORT: String(port), JERRY_DATA_DIR: folder }, stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(server);
    server.stdout.on('data', chunk => { logs += chunk; }); server.stderr.on('data', chunk => { logs += chunk; });
    for (let attempt = 0; attempt < 60; attempt++) {
      try { const response = await fetch(origin + '/api/gallery/likes', { signal: AbortSignal.timeout(1000) }); if (response.ok) { await response.arrayBuffer(); return { server, origin }; } } catch {}
      assert.equal(server.exitCode, null, logs); await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.fail(logs);
  }
  let first = await start();
  const seeds = require('../lib/gallery-photos.json').map(asset => asset.post), id = seeds[0].id;
  async function visitor(origin) {
    const response = await fetch(origin + '/api/gallery/likes'); assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie'); assert.match(cookie, /HttpOnly; SameSite=Lax/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return { cookie: cookie.split(';')[0], state: await response.json() };
  }
  async function state(origin, cookie) { return (await fetch(origin + '/api/gallery/likes', { headers: { cookie } })).json(); }
  async function vote(origin, cookie, liked, options = {}) {
    const response = await fetch(origin + '/api/gallery/likes', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie, ...options.headers }, body: options.body ?? JSON.stringify({ id: options.id ?? id, liked }) });
    return { status: response.status, data: await response.json() };
  }
  const alice = await visitor(first.origin), bob = await visitor(first.origin);
  await t.test('counts start at zero; each visitor sees their own likes', async () => {
    assert.equal(Object.keys(alice.state.counts).length, seeds.length);
    assert.ok(Object.values(alice.state.counts).every(count => count === 0)); assert.deepEqual(alice.state.liked, []);
    assert.notEqual(alice.cookie, bob.cookie);
    assert.deepEqual(await vote(first.origin, alice.cookie, true), { status: 200, data: { id, count: 1, liked: true } });
    assert.deepEqual((await state(first.origin, alice.cookie)).liked, [id]);
    const other = await state(first.origin, bob.cookie); assert.equal(other.counts[id], 1); assert.deepEqual(other.liked, []);
  });
  await t.test('duplicate votes count once; cancellation removes only the visitor', async () => {
    const repeated = await Promise.all(Array.from({ length: 8 }, () => vote(first.origin, alice.cookie, true)));
    assert.ok(repeated.every(result => result.status === 200 && result.data.count === 1));
    assert.equal((await vote(first.origin, bob.cookie, true)).data.count, 2);
    assert.equal((await vote(first.origin, alice.cookie, false)).data.count, 1);
    assert.equal((await vote(first.origin, alice.cookie, false)).data.count, 1);
    assert.deepEqual((await state(first.origin, bob.cookie)).liked, [id]);
  });
  await t.test('concurrent votes across two site processes preserve every vote', async () => {
    const second = await start(), people = await Promise.all(Array.from({ length: 12 }, () => visitor(first.origin)));
    const results = await Promise.all(people.map((person, i) => vote(i % 2 ? first.origin : second.origin, person.cookie, true)));
    assert.ok(results.every(result => result.status === 200)); assert.equal((await state(first.origin, bob.cookie)).counts[id], 13);
    await Promise.all(people.map((person, i) => vote(i % 2 ? second.origin : first.origin, person.cookie, false)));
    assert.equal((await state(second.origin, bob.cookie)).counts[id], 1); await stop(second.server);
  });
  await t.test('invalid requests cannot change content or corrupt the count', async () => {
    assert.equal((await vote(first.origin, alice.cookie, true, { headers: { Origin: 'https://foreign.example' } })).status, 403);
    assert.equal((await vote(first.origin, '', true)).status, 400);
    assert.equal((await vote(first.origin, alice.cookie, true, { headers: { 'Content-Type': 'text/plain' } })).status, 415);
    assert.equal((await vote(first.origin, alice.cookie, true, { body: JSON.stringify({ id, liked: true, title: 'Cannot edit' }) })).status, 400);
    assert.equal((await vote(first.origin, alice.cookie, true, { body: '{' })).status, 400);
    assert.equal((await vote(first.origin, alice.cookie, true, { body: ' '.repeat(1025) })).status, 413);
    assert.equal((await vote(first.origin, alice.cookie, true, { id: '11111111-1111-4111-8111-111111111111' })).status, 404);
    const posts = await (await fetch(first.origin + '/api/posts')).json();
    assert.deepEqual(posts.posts.map(photo => photo.id).sort(), seeds.map(photo => photo.id).sort());
    assert.equal((await state(first.origin, alice.cookie)).counts[id], 1);
    assert.ok(!(await fs.readFile(path.join(folder, 'gallery-likes.json'), 'utf8')).includes(bob.cookie.split('=')[1]));
  });
  await t.test('counts and the visitor state survive restarting the website', async () => {
    await stop(first.server); first = await start(); const restored = await state(first.origin, bob.cookie);
    assert.equal(restored.counts[id], 1); assert.deepEqual(restored.liked, [id]);
    assert.match(await (await fetch(first.origin + '/gallery')).text(), /photo-like--compact/);
  });
  await t.test('friends can like and undo through the relay; editing stays private', async () => {
    relay = createPreviewRelay(Number(new URL(first.origin).port)); await new Promise(resolve => relay.listen(0, '127.0.0.1', resolve));
    const publicOrigin = `http://127.0.0.1:${relay.address().port}`, friend = await visitor(publicOrigin);
    assert.equal((await vote(publicOrigin, friend.cookie, true)).data.count, 2);
    assert.deepEqual((await state(publicOrigin, friend.cookie)).liked, [id]);
    assert.equal((await vote(publicOrigin, friend.cookie, false)).data.count, 1);
    assert.equal((await fetch(publicOrigin + '/api/posts', { method: 'POST' })).status, 405);
    assert.equal((await fetch(publicOrigin + '/studio')).status, 404); assert.equal((await state(first.origin, bob.cookie)).counts[id], 1);
  });
});
