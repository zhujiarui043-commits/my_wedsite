import { cache } from 'react';
import { listPosts } from '@/lib/posts';

export const listNotes = cache(async () => (await listPosts())
  .filter(post => post.kind === 'journal')
  .sort((a, b) => b.taken_at.localeCompare(a.taken_at) || b.created_at.localeCompare(a.created_at)));

export const findNote = cache(async (id: string) => (await listNotes()).find(note => note.id === id));

export function noteExcerpt(body: string) {
  const text = body.replace(/\s+/g, ' ').trim();
  return text.length > 180 ? `${text.slice(0, 180).trimEnd()}…` : text;
}

export function noteDate(date: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${date}T12:00:00Z`));
}
