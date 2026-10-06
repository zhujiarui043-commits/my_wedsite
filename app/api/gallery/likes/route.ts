import { randomUUID } from 'node:crypto';
import { galleryLikeState, galleryVisitor, setGalleryLike } from '@/lib/gallery-likes';
import { GALLERY_VISITOR_COOKIE } from '@/lib/gallery-likes-shared';
import { ContentError } from '@/lib/editor-image';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store', Vary: 'Cookie' };
const fail = (message: string, status: number) => Response.json({ error: message }, { status, headers });

export async function GET(request: Request) {
  try {
    const existing = galleryVisitor(request), visitor = existing || randomUUID();
    return Response.json(await galleryLikeState(visitor), { headers: {
      ...headers,
      ...(!existing ? { 'Set-Cookie': `${GALLERY_VISITOR_COOKIE}=${visitor}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000` } : {}),
    } });
  } catch (error) { console.error(error); return fail('Could not load likes. Please try again.', 503); }
}
export async function POST(request: Request) {
  try {
    // Next's internal request URL can use a different host/port from the browser.
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    if (!host || request.headers.get('origin') !== new URL(`${protocol}://${host}`).origin) return fail('Open Gallery on this website to like a photograph.', 403);
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return fail('Send a valid like request.', 415);
    const visitor = galleryVisitor(request);
    if (!visitor) return fail('Reload Gallery before liking a photograph.', 400);
    const reader = request.body?.getReader();
    if (!reader) return fail('Send a valid like request.', 400);
    let body = '', bytes = 0;
    const decoder = new TextDecoder();
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 1024) { await reader.cancel(); return fail('Like request is too large.', 413); }
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
    let vote;
    try { vote = JSON.parse(body); } catch { return fail('Send a valid like request.', 400); }
    if (!vote || typeof vote.id !== 'string' || !/^[a-f0-9-]{36}$/.test(vote.id) || typeof vote.liked !== 'boolean' || Object.keys(vote).some(key => !['id', 'liked'].includes(key))) return fail('Send a valid like request.', 400);
    return Response.json(await setGalleryLike(vote.id, visitor, vote.liked), { headers });
  } catch (error) {
    if (error instanceof ContentError) return fail(error.message, error.status);
    console.error(error); return fail('Could not save your like. Please try again.', 503);
  }
}
