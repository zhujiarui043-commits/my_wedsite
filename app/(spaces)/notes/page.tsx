import type { Metadata } from 'next';
import SpacePage from '@/components/space-page';
import Guestbook from '@/components/guestbook';
import { guestbookState } from '@/lib/guestbook';
import './guestbook.css';

export const metadata: Metadata = { title: 'Guestbook | Jerry Zhu' };
export const dynamic = 'force-dynamic';

export default async function GuestbookPage() {
  const initialState = await guestbookState().catch(error => { console.error(error); return { messages: [], liked: [] }; });
  return <SpacePage spaceId="notes" fullWidth afterContent={<Guestbook initialState={initialState} />}>
    <p className="space-description">A little hello, a thought, or a story from you.</p>
  </SpacePage>;
}
