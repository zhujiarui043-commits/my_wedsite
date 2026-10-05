import type { Metadata } from 'next';
import SpacePage from '@/components/space-page';

export const metadata: Metadata = { title: 'Gallery | Jerry Zhu' };

export default function GalleryPage() {
  return <SpacePage spaceId="gallery" />;
}
