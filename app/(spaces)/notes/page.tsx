import type { Metadata } from 'next';
import SpacePage from '@/components/space-page';

export const metadata: Metadata = { title: 'Notes | Jerry Zhu' };

export default function NotesPage() {
  return <SpacePage spaceId="notes" />;
}
