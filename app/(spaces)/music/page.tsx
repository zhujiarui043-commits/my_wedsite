import type { Metadata } from 'next';
import SpacePage from '@/components/space-page';
import MusicReports from '@/components/music-reports';
import { musicReports } from '@/lib/music-reports';
import './music.css';

export const metadata: Metadata = { title: 'Music | Jerry Zhu' };

export default function MusicPage() {
  return <SpacePage spaceId="music" media={<MusicReports reports={musicReports} />}>
    <p className="space-description">Piano, favorite songs, and Eason.</p>
  </SpacePage>;
}
