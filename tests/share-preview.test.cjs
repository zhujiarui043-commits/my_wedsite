const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createPreviewRelay } = require('../scripts/share-preview.cjs');

function request(port, pathname, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const call = http.request({ hostname: '127.0.0.1', port, path: pathname, method, headers, agent: false }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }));
    });
    call.on('error', reject);
    call.end();
  });
}

test('temporary preview serves public pages while keeping editing private', async t => {
  const received = [];
  const origin = http.createServer((req, res) => {
    received.push({ method: req.method, url: req.url, headers: req.headers });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(received.at(-1)));
  });
  await new Promise(resolve => origin.listen(0, '127.0.0.1', resolve));
  const originPort = origin.address().port;
  const relay = createPreviewRelay(originPort);
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
      for (const pathname of ['/', '/api/posts']) {
        const result = await request(relayPort, pathname, method);
        assert.equal(result.status, 405);
        assert.equal(result.headers.allow, 'GET, HEAD');
      }
    }
    assert.equal(received.length, count);
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

  await t.test('the studio, API, unshared routes, and project files stay private', async () => {
    const count = received.length;
    for (const pathname of ['/studio', '/api/posts', '/api/images/example', '/moments', '/AGENTS.md', '/.env', '/data/posts.json']) {
      assert.equal((await request(relayPort, pathname)).status, 404);
    }
    assert.equal(received.length, count);
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
