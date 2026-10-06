import { bucket, listPosts, writePosts, withWriteLock } from '@/lib/posts';
import { localEditorGuard } from '@/lib/local-editor';
import { ContentError, saveEditorImage } from '@/lib/editor-image';
export const dynamic = 'force-dynamic';
const fail = (message: string, status: number) => Response.json({ error: message }, { status });

export async function GET(req: Request) {
  const denied = localEditorGuard(req, false); if (denied) return denied;
  try { return Response.json({ posts: await listPosts() }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { console.error(error); return fail('Could not load your content. Please try again.', 503); }
}
export async function POST(req: Request) { return withWriteLock(() => save(req, false)); }
export async function PATCH(req: Request) { return withWriteLock(() => save(req, true)); }
async function save(req: Request, edit: boolean) {
  const denied = localEditorGuard(req); if (denied) return denied;
  let newKey: string | null = null;
  try {
    if (Number(req.headers.get('content-length') || 0) > 13 * 1024 * 1024) throw new ContentError('Photos must be no larger than 12 MB.', 413);
    const form = await req.formData();
    const get = (key: string) => String(form.get(key) || '').trim();
    const id = edit ? get('id') : crypto.randomUUID();
    const kind = get('kind'), title = get('title'), body = get('body').replace(/\r\n?/g, '\n'), location = get('location'), takenAt = get('taken_at');
    if (!['photo', 'journal'].includes(kind) || !title || title.length > 100 || body.length > 20000 || location.length > 100 || !/^\d{4}-\d{2}-\d{2}$/.test(takenAt) || !Number.isFinite(Date.parse(takenAt)) || new Date(takenAt).toISOString().slice(0, 10) !== takenAt) throw new ContentError('Check the title, date, and content length.');
    const posts = await listPosts();
    const old = edit ? posts.find(post => post.id === id) : null;
    if (edit && !old) throw new ContentError('This entry no longer exists.', 404);
    if (form.has('featured') && !['true', 'false'].includes(get('featured'))) throw new ContentError('Choose whether this photograph belongs on the planet.');
    const featured = form.has('featured') ? get('featured') === 'true' : old?.kind === 'photo' ? old.featured !== false : false;
    newKey = await saveEditorImage(form.get('image'));
    const key = newKey || (get('remove_image') === 'true' ? null : old?.image_key || null);
    if (kind === 'photo' && !key) throw new ContentError('Add a photo to publish a photograph.');
    const now = new Date().toISOString();
    const post = { id, kind: kind as 'photo' | 'journal', title, body, image_key: key, location, taken_at: takenAt, created_at: old?.created_at || now, updated_at: now, ...(kind === 'photo' ? { featured } : {}) };
    await writePosts([post, ...posts.filter(post => post.id !== id)]);
    if (old?.image_key && old.image_key !== key) await bucket().delete(old.image_key).catch(error => console.error('Old image cleanup failed', error));
    return Response.json({ post });
  } catch (error) {
    if (newKey) await bucket().delete(newKey).catch(() => undefined);
    if (error instanceof ContentError) return fail(error.message, error.status);
    console.error(error); return fail('Could not save. Your text is still in the editor. Please try again.', 503);
  }
}
export async function DELETE(req: Request) {
  return withWriteLock(async () => {
    const denied = localEditorGuard(req); if (denied) return denied;
    try {
      const { id } = await req.json();
      if (typeof id !== 'string') return fail('Invalid entry ID.', 400);
      const posts = await listPosts();
      const old = posts.find(post => post.id === id);
      if (!old) return fail('This entry no longer exists.', 404);
      await writePosts(posts.filter(post => post.id !== id));
      if (old.image_key) await bucket().delete(old.image_key).catch(error => console.error(error));
      return Response.json({ id });
    } catch (error) { console.error(error); return fail('Could not delete. Please try again.', 503); }
  });
}
