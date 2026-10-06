import { listAlbums, saveAlbum, deleteAlbum } from '@/lib/albums';
import { withWriteLock } from '@/lib/posts';
import { localEditorGuard } from '@/lib/local-editor';
import { ContentError } from '@/lib/editor-image';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
const fail = (message: string, status: number) => Response.json({ error: message }, { status, headers });
export async function GET(request: Request) {
  const denied = localEditorGuard(request, false); if (denied) return denied;
  try { return Response.json({ albums: await listAlbums() }, { headers }); }
  catch (error) { console.error(error); return fail('Could not load your albums. Please try again.', 503); }
}
async function readInput(request: Request) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new ContentError('Send valid album details.', 415);
  const reader = request.body?.getReader(); if (!reader) throw new ContentError('Send valid album details.');
  let bytes = 0, text = ''; const decoder = new TextDecoder();
  while (true) {
    const chunk = await reader.read(); if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > 256 * 1024) { await reader.cancel(); throw new ContentError('Album details are too large.', 413); }
    text += decoder.decode(chunk.value, { stream: true });
  }
  try { return JSON.parse(text + decoder.decode()); } catch { throw new ContentError('Send valid album details.'); }
}
async function write(request: Request, action: 'create' | 'edit' | 'delete') {
  const denied = localEditorGuard(request); if (denied) return denied;
  return withWriteLock(async () => {
    try {
      const input = await readInput(request);
      if (action === 'delete') {
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => key !== 'id')) throw new ContentError('Choose a valid album.');
        await deleteAlbum(input.id); return Response.json({ id: input.id }, { headers });
      }
      return Response.json({ album: await saveAlbum(input, action === 'edit') }, { headers });
    } catch (error) {
      if (error instanceof ContentError) return fail(error.message, error.status);
      console.error(error); return fail('Could not save your album. Your choices are still in the editor.', 503);
    }
  });
}
export async function POST(request: Request) { return write(request, 'create'); }
export async function PATCH(request: Request) { return write(request, 'edit'); }
export async function DELETE(request: Request) { return write(request, 'delete'); }
