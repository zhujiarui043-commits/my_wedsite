const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const destinations = require('../lib/journey-destinations.json');

const root = path.resolve(__dirname, '..');
const pages = new Set([
  '/', '/about', '/journey', '/gallery', '/music', '/notes',
  ...destinations.map(destination => `/journey/${destination.slug}`),
]);
const forwardedHeaders = [
  'accept', 'accept-encoding', 'accept-language', 'user-agent',
  'if-none-match', 'if-modified-since', 'range', 'if-range',
  'rsc', 'next-router-state-tree', 'next-router-prefetch', 'next-router-segment-prefetch',
];

function publicPaths(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relative = `${prefix}/${entry.name}`;
    return entry.isDirectory()
      ? publicPaths(path.join(directory, entry.name), relative)
      : [relative];
  });
}

function createPreviewRelay(originPort) {
  const assets = new Set(publicPaths(path.join(root, 'public')));
  const server = http.createServer((request, response) => {
    function reject(status, message) {
      response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(message);
    }

    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('Allow', 'GET, HEAD');
      reject(405, 'This preview is read-only.');
      return;
    }

    let pathname;
    let query;
    try {
      const raw = request.url;
      if (!raw.startsWith('/') || raw.startsWith('//')) throw new Error('Invalid path');
      pathname = decodeURIComponent(raw.split('?')[0]);
      if (/[%\\\x00-\x1f]/.test(pathname) || pathname.split('/').some(segment => segment === '.' || segment === '..')) {
        throw new Error('Invalid path');
      }
      query = new URL(raw, 'http://preview.local').search;
    } catch {
      reject(400, 'Invalid preview address.');
      return;
    }

    const page = pages.has(pathname.replace(/\/$/, '') || '/');
    const staticFile = pathname.startsWith('/_next/static/')
      ? path.join(root, '.next', pathname.slice('/_next/'.length))
      : null;
    const nextAsset = staticFile && fs.existsSync(staticFile) && fs.statSync(staticFile).isFile();
    if (!page && !assets.has(pathname) && !nextAsset) {
      reject(404, 'This page is not part of the shared preview.');
      return;
    }

    const headers = { host: `127.0.0.1:${originPort}` };
    for (const name of forwardedHeaders) {
      if (request.headers[name] !== undefined) headers[name] = request.headers[name];
    }
    const upstream = http.request({
      hostname: '127.0.0.1', port: originPort,
      method: request.method, path: encodeURI(pathname) + query, headers,
    }, result => {
      response.writeHead(result.statusCode, result.headers);
      result.pipe(response);
    });
    upstream.setTimeout(15000, () => upstream.destroy(new Error('Preview timeout')));
    upstream.on('error', () => {
      if (!response.headersSent) reject(503, 'The preview is starting. Please try again shortly.');
      else response.destroy();
    });
    response.on('close', () => upstream.destroy());
    // Never forward request bodies or editing credentials to the origin.
    upstream.end();
    request.resume();
  });
  server.headersTimeout = 10000;
  server.requestTimeout = 15000;
  return server;
}

async function main() {
  const localOnly = process.argv.includes('--local-only');
  const binary = process.env.CLOUDFLARED_PATH || path.join(root, 'node_modules', '.cache', 'jerry-preview', 'cloudflared.exe');
  if (!localOnly && !fs.existsSync(binary)) {
    throw new Error('cloudflared is missing. See the temporary-sharing instructions in README.md.');
  }
  if (!fs.existsSync(path.join(root, '.next', 'BUILD_ID'))) {
    throw new Error('Build the website first with npm.cmd run build.');
  }

  const children = [];
  const relay = createPreviewRelay(3100);
  let stopping = false;
  function stop(code = 0) {
    if (stopping) return;
    stopping = true;
    for (const child of children) child.kill();
    relay.close();
    process.exit(code);
  }
  process.on('SIGINT', () => stop());
  process.on('SIGTERM', () => stop());

  function start(file, args) {
    const child = spawn(file, args, { cwd: root, stdio: 'inherit', windowsHide: true });
    children.push(child);
    child.on('error', error => { console.error(error.message); stop(1); });
    child.on('exit', code => { if (!stopping) stop(code || 0); });
    return child;
  }

  try {
    // Separate production preview from the editor's development server on port 3000.
    start(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3100']);
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const result = await fetch('http://127.0.0.1:3100/', { signal: AbortSignal.timeout(1000) });
        await result.arrayBuffer();
        if (result.ok) { ready = true; break; }
      } catch { /* Wait for the production server to start. */ }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error('The production preview did not start.');
    await new Promise((resolve, reject) => {
      relay.once('error', reject);
      relay.listen(3101, '127.0.0.1', resolve);
    });
    console.log('Read-only preview ready at http://127.0.0.1:3101');
    if (!localOnly) {
      console.log('Share the https://....trycloudflare.com address printed below. Keep this process running.');
      start(binary, ['tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', 'http://127.0.0.1:3101']);
    }
  } catch (error) {
    console.error(error.message);
    stop(1);
  }
}

module.exports = { createPreviewRelay };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
