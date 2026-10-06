import { listPosts, writePosts, withWriteLock } from '@/lib/posts';
import { localEditorGuard } from '@/lib/local-editor';
import { ContentError } from '@/lib/editor-image';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
const fail = (message: string, status: number) => Response.json({ error: message }, { status, headers });

export async function PATCH(request: Request) {
  const denied = localEditorGuard(request); if (denied) return denied;
  try {
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new ContentError('Send a photograph selection.', 415);
    const reader = request.body?.getReader(); if (!reader) throw new ContentError('Send a photograph selection.');
    let size = 0, text = ''; const decoder = new TextDecoder();
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 1024) { await reader.cancel(); throw new ContentError('Photograph selection is too large.', 413); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    let input;
    try { input = JSON.parse(text + decoder.decode()); } catch { throw new ContentError('Send a photograph selection.'); }
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['id', 'featured'].includes(key)) || typeof input.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(input.id) || typeof input.featured !== 'boolean') throw new ContentError('Choose a valid photograph and selection.');
    return await withWriteLock(async () => {
      const posts = await listPosts();
      const old = posts.find(post => post.id === input.id && post.kind === 'photo' && post.image_key);
      if (!old) throw new ContentError('This photograph no longer exists.', 404);
      const post = { ...old, featured: input.featured, updated_at: new Date().toISOString() };
      await writePosts(posts.map(item => item.id === post.id ? post : item));
      return Response.json({ post }, { headers });
    });
  } catch (error) {
    if (error instanceof ContentError) return fail(error.message, error.status);
    console.error(error); return fail('Could not update the planet selection. Please try again.', 503);
  }
}
