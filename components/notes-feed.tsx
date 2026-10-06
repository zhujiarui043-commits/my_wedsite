import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { type Post, imageUrl } from '@/lib/post-shared';
import { noteDate, noteExcerpt } from '@/lib/notes';

export default function NotesFeed({ notes }: { notes: Post[] }) {
  return (
    <section className="notes-feed" aria-label="Published notes">
      {notes.map(note => (
        <article key={note.id} className="notes-entry">
          <Link className={`notes-entry-link${note.image_key ? ' has-image' : ''}`} href={`/notes/${note.id}`} aria-label={`Read ${note.title}`}>
            <div className="notes-entry-copy">
              <div className="notes-meta">
                <time dateTime={note.taken_at}>{noteDate(note.taken_at)}</time>
                {note.location && <span>{note.location}</span>}
              </div>
              <h2>{note.title}</h2>
              {note.body && <p>{noteExcerpt(note.body)}</p>}
              <span className="notes-read">Read note <ArrowUpRight size={15} aria-hidden="true" /></span>
            </div>
            {note.image_key && <img className="notes-thumbnail" src={imageUrl(note)} alt="" loading="lazy" decoding="async" />}
          </Link>
        </article>
      ))}
    </section>
  );
}
