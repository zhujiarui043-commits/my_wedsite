import type { Metadata } from 'next';
import SpacePage from '@/components/space-page';
import NotesFeed from '@/components/notes-feed';
import { listNotes } from '@/lib/notes';

export const metadata: Metadata = { title: 'Notes | Jerry Zhu' };
export const dynamic = 'force-dynamic';

export default async function NotesPage() {
  let notes: Awaited<ReturnType<typeof listNotes>> = [];
  let failed = false;
  try { notes = await listNotes(); }
  catch (error) { console.error('Could not load notes', error); failed = true; }

  return (
    <SpacePage spaceId="notes" fullWidth>
      <p className="space-description">Essays, passing thoughts, and an occasional photograph.</p>
      {failed ? (
        <p className="notes-unavailable" role="alert">Could not load the notes. Please refresh and try again.</p>
      ) : notes.length ? <NotesFeed notes={notes} /> : (
        <section className="notes-empty" aria-labelledby="notes-empty-heading">
          <h2 id="notes-empty-heading">No notes yet.</h2>
          <p>New entries will appear here.</p>
        </section>
      )}
    </SpacePage>
  );
}
