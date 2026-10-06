import { ContentError } from './content-error';
export const guestbookHeaders = { 'Cache-Control': 'no-store', Vary: 'Cookie' };
export function guestbookOrigin(request: Request) {
  const host = request.headers.get('host'), protocol = request.headers.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  return !!host && request.headers.get('origin') === new URL(`${protocol}://${host}`).origin;
}
export async function guestbookInput(request: Request) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new ContentError('Send your message as JSON.', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new ContentError('Check your message.');
  let bytes = 0, text = ''; const decoder = new TextDecoder();
  while (true) {
    const chunk = await reader.read(); if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > 16 * 1024) { await reader.cancel(); throw new ContentError('Your message is too long.', 413); }
    text += decoder.decode(chunk.value, { stream: true });
  }
  try { return JSON.parse(text + decoder.decode()); } catch { throw new ContentError('Check your message.'); }
}
export function guestbookFailure(error: unknown) {
  if (error instanceof ContentError) return Response.json({ error: error.message }, { status: error.status, headers: guestbookHeaders });
  console.error(error);
  return Response.json({ error: 'The guestbook is temporarily unavailable. Please try again.' }, { status: 503, headers: guestbookHeaders });
}
