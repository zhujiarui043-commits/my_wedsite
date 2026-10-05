import type { Metadata } from 'next';
import SpacePage from '@/components/space-page';

export const metadata: Metadata = { title: 'Music | Jerry Zhu' };

export default function MusicPage() {
  return <SpacePage spaceId="music" />;
}
