const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');
const { createPreviewRelay } = require('../scripts/share-preview.cjs');

test('visitors leave messages, reply, and share persistent likes after removing the desktop editor', { timeout: 90000 }, async t => {
  const root = path.resolve(__dirname, '..'), website = path.join(root, '.next/standalone');
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'jerry-guestbook-test-'));
  let server, origin, relay, publicOrigin, logs = '';
  async function stop() {
    if (server && server.exitCode === null && server.signalCode === null) {
      const exited = new Promise(resolve => server.once('exit', resolve)); server.kill(); await exited;
    }
  }
  t.after(async () => {
    if (relay) { relay.closeAllConnections(); await new Promise(resolve => relay.close(resolve)); }
    await stop();
    const resolved = path.resolve(folder);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir())); assert.ok(path.basename(resolved).startsWith('jerry-guestbook-test-'));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  async function start() {
    const probe = net.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port; await new Promise(resolve => probe.close(resolve)); origin = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, [path.join(website, 'server.js')], { cwd: website, windowsHide: true, env: { ...process.env, HOSTNAME: '127.0.0.1', PORT: String(port), JERRY_DATA_DIR: folder }, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.on('data', chunk => { logs += chunk; }); server.stderr.on('data', chunk => { logs += chunk; });
    for (let attempt = 0; attempt < 60; attempt++) {
      try { const response = await fetch(origin + '/api/guestbook', { signal: AbortSignal.timeout(1000) }); if (response.ok) { await response.arrayBuffer(); return; } } catch {}
      assert.equal(server.exitCode, null, logs); await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.fail(logs);
  }
  async function visitor(address = origin) {
    const response = await fetch(address + '/api/guestbook'); assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const cookie = response.headers.get('set-cookie'); assert.match(cookie, /HttpOnly; SameSite=Lax/);
    return { cookie: cookie.split(';')[0], state: await response.json() };
  }
  async function write(address, cookie, input, headers = {}, method = 'POST', route = '/api/guestbook') {
    const response = await fetch(address + route, { method, headers: { Origin: address, Cookie: cookie, 'Content-Type': 'application/json', ...headers }, body: typeof input === 'string' ? input : JSON.stringify(input) });
    return { status: response.status, data: response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.text() };
  }
  await start();
  relay = createPreviewRelay(new URL(origin).port, { readPosts: () => [], readAlbums: () => [], readDestinations: () => [] });
  await new Promise(resolve => relay.listen(0, '127.0.0.1', resolve)); publicOrigin = `http://127.0.0.1:${relay.address().port}`;
  const a = await visitor(publicOrigin), b = await visitor(publicOrigin);
  const rootId = randomUUID(), replyId = randomUUID();
  const message = { action: 'message', id: rootId, nickname: '<b>Guest</b>', body: 'Hello!\n<script>alert("x")</script>', parentId: null };
  await t.test('a visitor posts once, retries safely, and another visitor replies through the public relay', async () => {
    assert.deepEqual(a.state, { messages: [], liked: [] });
    const posted = await write(publicOrigin, a.cookie, message); assert.equal(posted.status, 200); assert.equal(posted.data.messages.length, 1);
    assert.equal((await write(publicOrigin, a.cookie, message)).data.messages.length, 1);
    assert.equal((await write(publicOrigin, b.cookie, message)).status, 409);
    const reply = await write(publicOrigin, b.cookie, { action: 'message', id: replyId, nickname: 'A friend', body: 'A reply from another browser.', parentId: rootId });
    assert.equal(reply.status, 200); assert.equal(reply.data.messages[1].parentId, rootId);
    assert.ok(!JSON.stringify(reply.data).includes('authorHash'));
    const markup = await (await fetch(publicOrigin + '/notes')).text();
    assert.match(markup, /Guestbook/); assert.match(markup, /&lt;script&gt;/); assert.ok(!markup.includes('<b>Guest</b>'));
    assert.match(markup, /A reply from another browser/);
  });
  await t.test('likes are idempotent, work on replies, and preserve concurrent votes', async () => {
    for (let repeat = 0; repeat < 2; repeat++) {
      const liked = await write(publicOrigin, a.cookie, { action: 'like', id: rootId, liked: true });
      assert.equal(liked.status, 200); assert.equal(liked.data.messages.find(item => item.id === rootId).likes, 1);
    }
    const guests = await Promise.all(Array.from({ length: 8 }, () => visitor(publicOrigin)));
    const votes = await Promise.all(guests.map(guest => write(publicOrigin, guest.cookie, { action: 'like', id: rootId, liked: true })));
    assert.ok(votes.every(result => result.status === 200));
    const state = await (await fetch(publicOrigin + '/api/guestbook', { headers: { Cookie: a.cookie } })).json();
    assert.equal(state.messages.find(item => item.id === rootId).likes, 9); assert.ok(state.liked.includes(rootId));
    const unliked = await write(publicOrigin, a.cookie, { action: 'like', id: rootId, liked: false });
    assert.equal(unliked.data.messages.find(item => item.id === rootId).likes, 8); assert.ok(!unliked.data.liked.includes(rootId));
    const replyLike = await write(publicOrigin, a.cookie, { action: 'like', id: replyId, liked: true });
    assert.equal(replyLike.data.messages.find(item => item.id === replyId).likes, 1);
  });
  await t.test('limits and input validation reject invalid public writes', async () => {
    assert.equal((await write(publicOrigin, a.cookie, message, { Origin: 'https://foreign.example' })).status, 403);
    assert.equal((await write(origin, a.cookie, message, { Origin: 'https://foreign.example' })).status, 403);
    assert.equal((await write(origin, a.cookie, '{')).status, 400);
    assert.equal((await write(origin, a.cookie, ' '.repeat(16385))).status, 413);
    assert.equal((await write(origin, a.cookie, message, { 'Content-Type': 'text/plain' })).status, 415);
    for (const value of [
      { ...message, id: randomUUID(), nickname: ' ' },
      { ...message, id: randomUUID(), body: 'x'.repeat(2001) },
      { ...message, id: randomUUID(), parentId: randomUUID() },
      { action: 'like', id: randomUUID(), liked: true },
      { action: 'like', id: rootId, liked: true, admin: true },
    ]) assert.ok([400, 404].includes((await write(origin, a.cookie, value)).status));
    const spammer = await visitor(origin);
    for (let index = 0; index < 5; index++) assert.equal((await write(origin, spammer.cookie, { ...message, id: randomUUID(), nickname: 'Another guest', body: `Message ${index}` })).status, 200);
    assert.equal((await write(origin, spammer.cookie, { ...message, id: randomUUID(), body: 'Too many' })).status, 429);
    const stored = await fs.readFile(path.join(folder, 'guestbook.json'), 'utf8');
    assert.ok(!stored.includes(a.cookie.split('=')[1])); assert.ok(!stored.includes(b.cookie.split('=')[1]));
  });
  await t.test('messages and likes survive a restart; public visitors cannot delete them', async () => {
    relay.closeAllConnections(); await new Promise(resolve => relay.close(resolve)); relay = null;
    await stop(); await start();
    const state = await (await fetch(origin + '/api/guestbook', { headers: { Cookie: a.cookie } })).json();
    assert.equal(state.messages.find(item => item.id === rootId).likes, 8); assert.equal(state.messages.find(item => item.id === replyId).likes, 1);
    assert.ok(state.liked.includes(replyId));
    const before = await fs.readFile(path.join(folder, 'guestbook.json'));
    assert.equal((await write(origin, a.cookie, { id: rootId }, {}, 'DELETE', '/api/guestbook/moderate')).status, 404);
    assert.equal((await write(origin, a.cookie, { id: rootId }, {}, 'DELETE', '/api/guestbook')).status, 405);
    assert.deepEqual(await fs.readFile(path.join(folder, 'guestbook.json')), before);
  });
});
