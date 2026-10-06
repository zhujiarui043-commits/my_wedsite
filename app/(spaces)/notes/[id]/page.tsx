import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SpacePage from '@/components/space-page';
import { findNote, noteDate, noteExcerpt } from '@/lib/notes';
import { imageUrl } from '@/lib/post-shared';

type Props = { params: Promise<{ id: string }> };
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const note = await findNote((await params).id);
  if (!note) notFound();
  return { title: `${note.title} | Notes | Jerry Zhu`, description: noteExcerpt(note.body) };
}

export default async function NotePage({ params }: Props) {
  const note = await findNote((await params).id);
  if (!note) notFound();

  return (
    <SpacePage
      spaceId="notes"
      title={note.title}
      backLink={{ href: '/notes', label: 'Back to Notes' }}
      fullWidth={!note.image_key}
      media={note.image_key ? (
        <figure className="space-photo notes-photo">
          <img src={imageUrl(note)} alt={note.title} decoding="async" />
        </figure>
      ) : undefined}
    >
      <div className="notes-meta notes-detail-meta">
        <time dateTime={note.taken_at}>{noteDate(note.taken_at)}</time>
        {note.location && <span>{note.location}</span>}
      </div>
      <article className="notes-body" aria-label="Note text">
        {note.body.replace(/\r\n?/g, '\n').split(/\n\s*\n/).filter(paragraph => paragraph.trim()).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </article>
    </SpacePage>
  );
}
