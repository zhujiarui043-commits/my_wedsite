import type { Metadata } from 'next';
import Gallery from '../gallery';
import { listPosts } from '@/lib/posts';

export const metadata: Metadata = { title: 'Moments · Photo Journal | Jerry Zhu', description: 'Photographs and everyday moments by Jerry Zhu.' };
export const dynamic = 'force-dynamic';

export default async function MomentsPage() {
  let posts: Awaited<ReturnType<typeof listPosts>> = [];
  let error = '';
  try { posts = await listPosts(); }
  catch (e) { console.error(e); error = 'Could not load the journal. Please refresh and try again.'; }
  return <Gallery posts={posts} error={error}/>;
}
