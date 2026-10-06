const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const destinations = require('../lib/journey-destinations.json');
const seedPhotos = require('../lib/gallery-photos.json').map(asset => asset.post);

const root = path.resolve(__dirname, '..');
const dataRoot = path.resolve(process.env.JERRY_DATA_DIR || path.join(root, 'data'));
const pages = new Set([
  '/', '/about', '/journey', '/gallery', '/music', '/notes',
]);
const forwardedHeaders = [
  'accept', 'accept-encoding', 'accept-language', 'user-agent',
  'if-none-match', 'if-modified-since', 'range', 'if-range',
  'rsc', 'next-router-state-tree', 'next-router-prefetch', 'next-router-segment-prefetch',
];
const likesPath = '/api/gallery/likes';
const visitorCookie = 'jerry_gallery_visitor';
const visitorPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

function publicPaths(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relative = `${prefix}/${entry.name}`;
    return entry.isDirectory()
      ? publicPaths(path.join(directory, entry.name), relative)
      : [relative];
  });
}

function readPreviewPosts() {
  try {
    const posts = JSON.parse(fs.readFileSync(path.join(dataRoot, 'posts.json'), 'utf8'));
    if (!Array.isArray(posts)) throw new Error('Invalid journal data');
    return posts;
  } catch (error) {
    if (error.code === 'ENOENT') return seedPhotos;
    throw error;
  }
}

function readPreviewDestinations() {
  try {
    const entries = JSON.parse(fs.readFileSync(path.join(dataRoot, 'destinations.json'), 'utf8'));
    if (!Array.isArray(entries)) throw new Error('Invalid destination data');
    return entries;
  } catch (error) {
    if (error.code === 'ENOENT') return destinations;
    throw error;
  }
}

function readPreviewAlbums() {
  try {
    const entries = JSON.parse(fs.readFileSync(path.join(dataRoot, 'albums.json'), 'utf8'));
    if (!Array.isArray(entries)) throw new Error('Invalid album data');
    return entries;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function createPreviewRelay(originPort, { readPosts = readPreviewPosts, readDestinations = readPreviewDestinations, readAlbums = readPreviewAlbums } = {}) {
  const assets = new Set(publicPaths(path.join(root, 'public')));
  const server = http.createServer(async (request, response) => {
    function reject(status, message) {
      response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(message);
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

    const normalizedPath = pathname.replace(/\/$/, '') || '/';
    const likes = pathname === likesPath;
    if (!['GET', 'HEAD'].includes(request.method) && !(likes && request.method === 'POST')) {
      response.setHeader('Allow', likes ? 'GET, HEAD, POST' : 'GET, HEAD');
      reject(405, 'This preview does not allow content editing.');
      return;
    }
    let likeBody;
    if (likes && request.method === 'POST') {
      try {
        const origin = new URL(request.headers.origin);
        if (!['http:', 'https:'].includes(origin.protocol) || origin.host !== request.headers.host || origin.origin !== request.headers.origin) throw new Error('Foreign origin');
      } catch { reject(403, 'Open Gallery on this preview to like a photograph.'); return; }
      if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
        reject(415, 'Send a valid like request.'); return;
      }
      let bytes = 0, chunks = [];
      try {
        for await (const chunk of request) {
          bytes += chunk.length;
          if (bytes <= 1024) chunks.push(chunk);
        }
        if (bytes > 1024) { reject(413, 'Like request is too large.'); return; }
        const vote = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!vote || typeof vote.id !== 'string' || !/^[a-f0-9-]{36}$/.test(vote.id) || typeof vote.liked !== 'boolean' || Object.keys(vote).some(key => !['id', 'liked'].includes(key))) throw new Error('Invalid vote');
        let available;
        try { available = readPosts().some(post => post.kind === 'photo' && post.image_key && post.id === vote.id); }
        catch { reject(503, 'The content is temporarily unavailable.'); return; }
        if (!available) { reject(404, 'This photograph is no longer available.'); return; }
        likeBody = JSON.stringify({ id: vote.id, liked: vote.liked });
      } catch { if (!response.headersSent) reject(400, 'Send a valid like request.'); return; }
    }
    const page = pages.has(normalizedPath);
    const noteId = /^\/notes\/([a-f0-9-]{36})$/.exec(normalizedPath)?.[1];
    const albumId = /^\/gallery\/albums\/([a-f0-9-]{36})$/.exec(normalizedPath)?.[1];
    const imageKey = /^\/api\/images\/([a-f0-9-]{36})$/.exec(pathname)?.[1];
    const destinationSlug = /^\/journey\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(normalizedPath)?.[1];
    let posts = [];
    let entries = [];
    let albums = [];
    if (albumId) {
      try { albums = readAlbums(); }
      catch { reject(503, 'The albums are temporarily unavailable.'); return; }
    }
    if (noteId || imageKey) {
      try { posts = readPosts().filter(post => ['journal', 'photo'].includes(post.kind)); }
      catch { reject(503, 'The content is temporarily unavailable.'); return; }
    }
    if (destinationSlug || imageKey) {
      try { entries = readDestinations(); }
      catch { reject(503, 'The destinations are temporarily unavailable.'); return; }
    }
    const notePage = noteId && posts.some(post => post.kind === 'journal' && post.id === noteId);
    const albumPage = albumId && albums.some(album => album.id === albumId);
    const destinationPage = destinationSlug && entries.some(entry => entry.slug === destinationSlug);
    const publishedImage = imageKey && (posts.some(post => post.image_key === imageKey) || entries.some(entry => entry.image_key === imageKey));
    const staticFile = pathname.startsWith('/_next/static/')
      ? path.join(root, '.next', pathname.slice('/_next/'.length))
      : null;
    const nextAsset = staticFile && fs.existsSync(staticFile) && fs.statSync(staticFile).isFile();
    if (!likes && !page && !albumPage && !notePage && !destinationPage && !publishedImage && !assets.has(pathname) && !nextAsset) {
      reject(404, 'This page is not part of the shared preview.');
      return;
    }

    const headers = { host: `127.0.0.1:${originPort}` };
    for (const name of forwardedHeaders) {
      if (request.headers[name] !== undefined) headers[name] = request.headers[name];
    }
    if (likes) {
      const cookie = request.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(`${visitorCookie}=`));
      if (cookie && visitorPattern.test(cookie.slice(visitorCookie.length + 1))) headers.cookie = cookie;
      if (likeBody) {
        headers.origin = `http://127.0.0.1:${originPort}`;
        headers['content-type'] = 'application/json';
        headers['content-length'] = Buffer.byteLength(likeBody);
      }
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
    // Only validated anonymous photo votes carry a body or visitor cookie.
    upstream.end(likeBody);
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
    start(process.execPath, [path.join(root, 'scripts', 'start-website.cjs'), '3100']);
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
    console.log('Public preview ready at http://127.0.0.1:3101');
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
