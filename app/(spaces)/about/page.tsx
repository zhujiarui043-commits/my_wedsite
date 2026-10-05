import type { Metadata } from 'next';
import SpacePage from '@/components/space-page';

export const metadata: Metadata = { title: 'About | Jerry Zhu' };

export default function AboutPage() {
  return <SpacePage spaceId="about" />;
}
