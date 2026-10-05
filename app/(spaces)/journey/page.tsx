import type { Metadata } from 'next';
import SpacePage from '@/components/space-page';

export const metadata: Metadata = { title: 'Journey | Jerry Zhu' };

export default function JourneyPage() {
  return <SpacePage spaceId="journey" />;
}
