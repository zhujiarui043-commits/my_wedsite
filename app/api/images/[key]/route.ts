import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { imagePreviews } from '@/lib/image-previews';

type Context = { params: Promise<{ key: string }> };

async function serveImage(request: Request, { params }: Context) {
  try {
    const { key } = await params;
    if (!/^[a-f0-9-]{36}$/.test(key)) return new Response('Not found', { status: 404 });
    const size = new URL(request.url).searchParams.get('size') || 'original';
    if (!['original', 'thumb', 'preview'].includes(size)) return new Response('Invalid image size', { status: 400 });
    const file = await imagePreviews.get(key, size);
    if (!file) return new Response('Not found', { status: 404 });
    const headers = new Headers({
      'content-type': file.contentType,
      'etag': file.etag,
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    });
    if (request.headers.get('if-none-match')?.split(',').some(value => value.trim().replace(/^W\//, '') === file.etag || value.trim() === '*')) {
      return new Response(null, { status: 304, headers });
    }
    headers.set('content-length', String(file.bytes));
    if (request.method === 'HEAD') return new Response(null, { headers });
    const stream = Readable.toWeb(createReadStream(file.path)) as ReadableStream<Uint8Array>;
    return new Response(stream, { headers });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Response('Not found', { status: 404 });
    console.error(error);
    return new Response('Image unavailable', { status: 503 });
  }
}
export const GET = serveImage;
export const HEAD = serveImage;
