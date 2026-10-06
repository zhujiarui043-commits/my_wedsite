import { listDestinations, writeDestinations } from '@/lib/destinations';
import { bucket, withWriteLock } from '@/lib/posts';
import { localEditorGuard } from '@/lib/local-editor';
import { ContentError, saveEditorImage } from '@/lib/editor-image';
import type { Destination } from '@/lib/destination-shared';

export const dynamic = 'force-dynamic';
const fail = (message: string, status: number) => Response.json({ error: message }, { status });

export async function GET(req: Request) {
  const denied = localEditorGuard(req, false); if (denied) return denied;
  try { return Response.json({ destinations: await listDestinations() }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return fail('Could not load destinations. Please try again.', 503); }
}
export async function POST(req: Request) { return withWriteLock(() => save(req, false)); }
export async function PATCH(req: Request) { return withWriteLock(() => save(req, true)); }
async function save(req: Request, edit: boolean) {
  const denied = localEditorGuard(req); if (denied) return denied;
  let newKey: string | null = null;
  try {
    if (Number(req.headers.get('content-length') || 0) > 13 * 1024 * 1024) throw new ContentError('Choose a photo up to 12 MB.', 413);
    const form = await req.formData();
    const get = (key: string) => String(form.get(key) || '').trim();
    const slug = get('slug'), name = get('name'), region = get('region'), body = get('body').replace(/\r\n?/g, '\n'), country = get('country') || 'CHN';
    const longitude = get('longitude') === '' ? null : Number(get('longitude'));
    const latitude = get('latitude') === '' ? null : Number(get('latitude'));
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80 || !name || name.length > 100 || region.length > 100 || body.length > 20000) throw new ContentError('Check the name, page address, and text length.');
    if (!['CHN', 'JPN', 'KOR'].includes(country)) throw new ContentError('Choose a country from the list.');
    if ((longitude === null) !== (latitude === null) || (longitude !== null && (!Number.isFinite(longitude) || Math.abs(longitude) > 180 || !Number.isFinite(latitude) || Math.abs(latitude!) > 90))) throw new ContentError('Enter a valid longitude and latitude together, or leave both blank.');
    const entries = await listDestinations();
    const old = entries.find(entry => entry.slug === slug);
    if (edit && !old) throw new ContentError('This destination no longer exists.', 404);
    if (!edit && old) throw new ContentError('That page address already exists. Choose another one.', 409);
    newKey = await saveEditorImage(form.get('image'));
    const key = newKey || (get('remove_image') === 'true' ? null : old?.image_key || null);
    const destination: Destination = { slug, name, region: region || undefined, paragraphs: body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean), image_key: key, country, longitude, latitude };
    await writeDestinations(edit ? entries.map(entry => entry.slug === slug ? destination : entry) : [...entries, destination]);
    if (old?.image_key && old.image_key !== key) await bucket().delete(old.image_key).catch(error => console.error('Old image cleanup failed', error));
    return Response.json({ destination });
  } catch (error) {
    if (newKey) await bucket().delete(newKey).catch(() => undefined);
    if (error instanceof ContentError) return fail(error.message, error.status);
    console.error(error); return fail('Could not save. Your text is still in the editor.', 503);
  }
}
export async function DELETE(req: Request) {
  return withWriteLock(async () => {
    const denied = localEditorGuard(req); if (denied) return denied;
    try {
      const { slug } = await req.json();
      if (typeof slug !== 'string') return fail('Invalid destination.', 400);
      const entries = await listDestinations();
      const old = entries.find(entry => entry.slug === slug);
      if (!old) return fail('This destination no longer exists.', 404);
      await writeDestinations(entries.filter(entry => entry.slug !== slug));
      if (old.image_key) await bucket().delete(old.image_key).catch(error => console.error(error));
      return Response.json({ slug });
    } catch (error) { console.error(error); return fail('Could not delete. Please try again.', 503); }
  });
}
