import { randomUUID } from 'node:crypto';
import { guestbookState, guestbookVisitor, updateGuestbook } from '@/lib/guestbook';
import { GUESTBOOK_COOKIE } from '@/lib/guestbook-shared';
import { guestbookFailure, guestbookHeaders, guestbookInput, guestbookOrigin } from '@/lib/guestbook-http';
import { ContentError } from '@/lib/content-error';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const existing = guestbookVisitor(request), visitor = existing || randomUUID();
    return Response.json(await guestbookState(visitor), { headers: { ...guestbookHeaders, ...(!existing ? { 'Set-Cookie': `${GUESTBOOK_COOKIE}=${visitor}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000` } : {}) } });
  } catch (error) { return guestbookFailure(error); }
}
export async function POST(request: Request) {
  try {
    if (!guestbookOrigin(request)) throw new ContentError('Open the guestbook on this website to leave a message.', 403);
    const visitor = guestbookVisitor(request);
    if (!visitor) throw new ContentError('Refresh the guestbook before leaving a message.');
    return Response.json(await updateGuestbook(await guestbookInput(request), visitor), { headers: guestbookHeaders });
  } catch (error) { return guestbookFailure(error); }
}
