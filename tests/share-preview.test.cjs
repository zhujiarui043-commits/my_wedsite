const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createPreviewRelay } = require('../scripts/share-preview.cjs');
const { computeCacheBustingSearchParam } = require('next/dist/shared/lib/router/utils/cache-busting-search-param');

function request(port, pathname, method = 'GET', headers = {}, body) {
  return new Promise((resolve, reject) => {
    const call = http.request({ hostname: '127.0.0.1', port, path: pathname, method, headers, agent: false }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }));
    });
    call.on('error', reject);
    call.end(body);
  });
}

test('navigation and prefetch keep the RSC cache key valid through the relay', async t => {
  const origin = http.createServer(async (req, res) => {
    const expectedHash = await computeCacheBustingSearchParam(
      req.headers['next-router-prefetch'], req.headers['next-router-segment-prefetch'],
      req.headers['next-router-state-tree'], req.headers['next-url'],
    );
    const url = new URL(req.url, 'http://preview.local');
    if (url.searchParams.get('_rsc') !== expectedHash) {
      url.searchParams.set('_rsc', expectedHash);
      res.writeHead(307, { location: url.pathname + url.search });
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/x-component' });
    res.end('0:{"navigation":"ready"}\n');
  });
  await new Promise(resolve => origin.listen(0, '127.0.0.1', resolve));
  const relay = createPreviewRelay(origin.address().port);
  await new Promise(resolve => relay.listen(0, '127.0.0.1', resolve));
  t.after(() => { relay.close(); origin.close(); });

  const stateTree = encodeURIComponent(JSON.stringify(['', { children: ['__PAGE__', {}] }]));
  for (const [pathname, navigation] of [
    ['/about', { 'next-router-prefetch': '1', 'next-router-segment-prefetch': '/_tree' }],
    ['/journey', { 'next-router-state-tree': stateTree }],
  ]) {
    const headers = { rsc: '1', 'next-url': '/', ...navigation };
    const hash = await computeCacheBustingSearchParam(
      headers['next-router-prefetch'], headers['next-router-segment-prefetch'],
      headers['next-router-state-tree'], headers['next-url'],
    );
    const result = await request(relay.address().port, `${pathname}?_rsc=${hash}`, 'GET', headers);
    assert.equal(result.status, 200, `${pathname} must load without a cache-key redirect`);
    assert.equal(result.headers['content-type'], 'text/x-component');
    assert.equal(result.headers.location, undefined);
  }
});

test('temporary preview serves public pages while keeping editing private', async t => {
  const received = [];
  const origin = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    received.push({ method: req.method, url: req.url, headers: req.headers, body });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(received.at(-1)));
  });
  await new Promise(resolve => origin.listen(0, '127.0.0.1', resolve));
  const originPort = origin.address().port;
  const publishedPosts = [];
  const publishedAlbums = [];
  const publishedDestinations = structuredClone(require('../lib/journey-destinations.json'));
  const relay = createPreviewRelay(originPort, { readPosts: () => publishedPosts, readDestinations: () => publishedDestinations, readAlbums: () => publishedAlbums });
  await new Promise(resolve => relay.listen(0, '127.0.0.1', resolve));
  const relayPort = relay.address().port;
  t.after(() => { relay.close(); origin.close(); });

  await t.test('all six pages and public images can be read', async () => {
    for (const pathname of ['/', '/about', '/journey', '/gallery', '/music', '/notes', '/background.jpg', '/profile.jpg', '/icons/github.svg']) {
      assert.equal((await request(relayPort, pathname)).status, 200);
    }
    assert.equal((await request(relayPort, '/about/', 'HEAD')).status, 200);
  });

  await t.test('client navigation keeps RSC headers and query strings, without forwarding credentials', async () => {
    const result = await request(relayPort, '/music?_rsc=example', 'GET', {
      host: 'friend-preview.example', rsc: '1', 'next-router-state-tree': 'example-state',
      cookie: 'local-admin=private', authorization: 'Bearer private',
    });
    const forwarded = JSON.parse(result.body);
    assert.equal(forwarded.url, '/music?_rsc=example');
    assert.equal(forwarded.headers.rsc, '1');
    assert.equal(forwarded.headers['next-router-state-tree'], 'example-state');
    assert.equal(forwarded.headers.host, `127.0.0.1:${originPort}`);
    assert.equal(forwarded.headers.cookie, undefined);
    assert.equal(forwarded.headers.authorization, undefined);
  });

  await t.test('all write methods are rejected before reaching the origin', async () => {
    const count = received.length;
    for (const method of ['POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS']) {
      for (const pathname of ['/', '/api/posts', '/api/albums', '/api/gallery/featured']) {
        const result = await request(relayPort, pathname, method);
        assert.equal(result.status, 405);
        assert.equal(result.headers.allow, 'GET, HEAD');
      }
    }
    assert.equal(received.length, count);
  });

  await t.test('only published-photo likes pass through, carrying no editing credentials', async () => {
    const id = '66666666-6666-4666-8666-666666666666';
    const cookie = 'jerry_gallery_visitor=77777777-7777-4777-8777-777777777777';
    const headers = { host: 'friend-preview.example', origin: 'https://friend-preview.example', 'content-type': 'application/json', cookie: `${cookie}; local-admin=private`, authorization: 'Bearer private' };
    publishedPosts.push({ id, kind: 'photo', image_key: id });
    const get = await request(relayPort, '/api/gallery/likes', 'GET', headers);
    assert.equal(get.status, 200);
    assert.equal(JSON.parse(get.body).headers.cookie, cookie);
    const liked = await request(relayPort, '/api/gallery/likes', 'POST', headers, JSON.stringify({ id, liked: true }));
    assert.equal(liked.status, 200);
    const forwarded = JSON.parse(liked.body);
    assert.equal(forwarded.method, 'POST');
    assert.equal(forwarded.headers.cookie, cookie);
    assert.equal(forwarded.headers.authorization, undefined);
    assert.equal(forwarded.headers.origin, `http://127.0.0.1:${originPort}`);
    assert.deepEqual(JSON.parse(forwarded.body), { id, liked: true });
    const before = received.length;
    for (const method of ['PUT', 'PATCH', 'DELETE']) assert.equal((await request(relayPort, '/api/gallery/likes', method)).status, 405);
    assert.equal((await request(relayPort, '/api/gallery/likes', 'POST', { ...headers, origin: 'https://foreign.example' }, JSON.stringify({ id, liked: true }))).status, 403);
    assert.equal((await request(relayPort, '/api/gallery/likes', 'POST', { ...headers, 'content-type': 'text/plain' }, '{}')).status, 415);
    for (const body of ['{', JSON.stringify({ id, liked: true, title: 'Cannot edit' }), JSON.stringify({ id, liked: 'true' })]) assert.equal((await request(relayPort, '/api/gallery/likes', 'POST', headers, body)).status, 400);
    assert.equal((await request(relayPort, '/api/gallery/likes', 'POST', headers, ' '.repeat(1025))).status, 413);
    publishedPosts[0].kind = 'journal';
    assert.equal((await request(relayPort, '/api/gallery/likes', 'POST', headers, JSON.stringify({ id, liked: true }))).status, 404);
    publishedPosts.splice(0);
    assert.equal((await request(relayPort, '/api/gallery/likes', 'POST', headers, JSON.stringify({ id, liked: true }))).status, 404);
    assert.equal(received.length, before);
    const invalidCookie = await request(relayPort, '/api/gallery/likes', 'GET', { cookie: 'jerry_gallery_visitor=invalid; local-admin=private' });
    assert.equal(JSON.parse(invalidCookie.body).headers.cookie, undefined);
  });

  await t.test('guestbook messages, replies, and likes pass through without exposing moderation', async () => {
    const id = '12345678-1234-4234-8234-123456789012';
    const cookie = 'jerry_guestbook_visitor=77777777-7777-4777-8777-777777777777';
    const headers = { host: 'friend-preview.example', origin: 'https://friend-preview.example', 'content-type': 'application/json', cookie: `${cookie}; local-admin=private; jerry_gallery_visitor=66666666-6666-4666-8666-666666666666`, authorization: 'Bearer private' };
    const get = await request(relayPort, '/api/guestbook', 'GET', headers);
    assert.equal(get.status, 200); assert.equal(JSON.parse(get.body).headers.cookie, cookie);
    for (const input of [
      { action: 'message', id, nickname: 'A visitor', body: 'Hello!', parentId: null },
      { action: 'message', id, nickname: 'A visitor', body: 'A reply', parentId: id },
      { action: 'like', id, liked: true },
    ]) {
      const result = await request(relayPort, '/api/guestbook', 'POST', headers, JSON.stringify(input));
      assert.equal(result.status, 200);
      const forwarded = JSON.parse(result.body);
      assert.deepEqual(JSON.parse(forwarded.body), input);
      assert.equal(forwarded.headers.cookie, cookie); assert.equal(forwarded.headers.authorization, undefined);
      assert.equal(forwarded.headers.origin, `http://127.0.0.1:${originPort}`);
    }
    const before = received.length;
    assert.equal((await request(relayPort, '/api/guestbook', 'POST', { ...headers, origin: 'https://foreign.example' }, '{}')).status, 403);
    assert.equal((await request(relayPort, '/api/guestbook', 'POST', { ...headers, 'content-type': 'text/plain' }, '{}')).status, 415);
    for (const input of [{ action: 'delete', id }, { action: 'message', id, nickname: 'A', body: 'x'.repeat(2001), parentId: null }, { action: 'like', id, liked: true, admin: true }]) assert.equal((await request(relayPort, '/api/guestbook', 'POST', headers, JSON.stringify(input))).status, 400);
    assert.equal((await request(relayPort, '/api/guestbook', 'POST', headers, ' '.repeat(16385))).status, 413);
    assert.equal((await request(relayPort, '/api/guestbook/moderate', 'GET', headers)).status, 404);
    for (const route of ['/api/guestbook', '/api/guestbook/moderate']) assert.equal((await request(relayPort, route, 'DELETE', headers, JSON.stringify({ id }))).status, 405);
    assert.equal(received.length, before);
  });

  await t.test('destination journals are shared while unknown and deeper routes stay private', async () => {
    for (const slug of ['shanghai', 'osaka', 'hong-kong', 'macao', 'changchun', 'liaoning', 'yushan-island', 'jiande', 'yancheng']) {
      const result = await request(relayPort, `/journey/${slug}?_rsc=journal`, 'GET', { rsc: '1' });
      assert.equal(result.status, 200);
      const forwarded = JSON.parse(result.body);
      assert.equal(forwarded.url, `/journey/${slug}?_rsc=journal`);
      assert.equal(forwarded.headers.rsc, '1');
    }
    assert.equal((await request(relayPort, '/journey/shanghai/', 'HEAD')).status, 200);
    const count = received.length;
    for (const pathname of ['/journey/unknown', '/journey/shanghai/studio', '/journey/shanghai/api/posts']) {
      assert.equal((await request(relayPort, pathname)).status, 404);
    }
    assert.equal(received.length, count);
  });

  await t.test('published albums appear without a restart while album editing stays private', async () => {
    const id = '88888888-8888-4888-8888-888888888888';
    assert.equal((await request(relayPort, `/gallery/albums/${id}`)).status, 404);
    publishedAlbums.push({ id });
    const result = await request(relayPort, `/gallery/albums/${id}?_rsc=album`, 'GET', { rsc: '1' });
    assert.equal(result.status, 200); assert.equal(JSON.parse(result.body).headers.rsc, '1');
    assert.equal((await request(relayPort, `/gallery/albums/${id}/`, 'HEAD')).status, 200);
    for (const route of ['/api/albums', `/gallery/albums/${id}/edit`, `/gallery/albums/${id}/api/posts`]) assert.equal((await request(relayPort, route)).status, 404);
    assert.equal((await request(relayPort, `/gallery/albums/${id}`, 'POST')).status, 405);
    publishedAlbums.pop();
    assert.equal((await request(relayPort, `/gallery/albums/${id}`)).status, 404);
  });

  await t.test('the studio, API, unshared routes, and project files stay private', async () => {
    const count = received.length;
    for (const pathname of ['/studio', '/api/posts', '/api/gallery/featured', '/api/images/example', '/moments', '/AGENTS.md', '/.env', '/data/posts.json']) {
      assert.equal((await request(relayPort, pathname)).status, 404);
    }
    assert.equal(received.length, count);
  });

  await t.test('new notes and Gallery photos appear immediately, while unattached images and editing stay private', async () => {
    const noteId = '11111111-1111-4111-8111-111111111111';
    const photoKey = '22222222-2222-4222-8222-222222222222';
    const privateKey = '33333333-3333-4333-8333-333333333333';
    assert.equal((await request(relayPort, `/notes/${noteId}`)).status, 404);
    publishedPosts.push({ id: noteId, kind: 'journal', image_key: photoKey });
    publishedPosts.push({ id: privateKey, kind: 'photo', image_key: privateKey });
    assert.equal((await request(relayPort, `/notes/${noteId}?_rsc=note`, 'GET', { rsc: '1' })).status, 200);
    assert.equal((await request(relayPort, `/notes/${noteId}/`, 'HEAD')).status, 200);
    assert.equal((await request(relayPort, `/api/images/${photoKey}`)).status, 200);
    assert.equal((await request(relayPort, `/api/images/${privateKey}`)).status, 200);
    const count = received.length;
    for (const pathname of [`/notes/${privateKey}`, '/api/images/44444444-4444-4444-8444-444444444444', `/notes/${noteId}/edit`, '/studio/notes', '/writer', '/api/posts', '/api/destinations']) {
      assert.equal((await request(relayPort, pathname)).status, 404);
    }
    assert.equal((await request(relayPort, `/notes/${noteId}`, 'POST')).status, 405);
    assert.equal(received.length, count);
    publishedPosts.splice(0, publishedPosts.length);
    assert.equal((await request(relayPort, `/notes/${noteId}`)).status, 404);
    assert.equal((await request(relayPort, `/api/images/${photoKey}`)).status, 404);
  });

  await t.test('published destinations and their photos are shared without a restart, then disappear after deletion', async () => {
    const key = '55555555-5555-4555-8555-555555555555';
    assert.equal((await request(relayPort, '/journey/chengdu')).status, 404);
    publishedDestinations.push({ slug: 'chengdu', image_key: key });
    assert.equal((await request(relayPort, '/journey/chengdu?_rsc=travel', 'GET', { rsc: '1' })).status, 200);
    assert.equal((await request(relayPort, `/api/images/${key}`)).status, 200);
    assert.equal((await request(relayPort, '/journey/chengdu/edit')).status, 404);
    publishedDestinations.pop();
    assert.equal((await request(relayPort, '/journey/chengdu')).status, 404);
    assert.equal((await request(relayPort, `/api/images/${key}`)).status, 404);
  });

  await t.test('encoded and double-encoded traversal cannot bypass the route restrictions', async () => {
    const count = received.length;
    for (const pathname of [
      '/icons/../studio', '/icons/%2e%2e/studio', '/icons%2f..%2fstudio',
      '/_next/static/%2e%2e/%2e%2e/studio', '/icons/%252e%252e%252fstudio',
      '/icons/%5c..%5cstudio', '/icons/%00github.svg', '//example.com/studio',
    ]) {
      assert.equal((await request(relayPort, pathname)).status, 400);
    }
    assert.equal(received.length, count);
  });
});
