import type { Metadata } from 'next';
import SpacePage from '@/components/space-page';
import MusicReports from '@/components/music-reports';
import MusicRecordings from '@/components/music-recordings';
import { musicReports } from '@/lib/music-reports';
import { musicRecordingGroups } from '@/lib/music-recordings';
import './music.css';

export const metadata: Metadata = { title: 'Music | Jerry Zhu' };

export default function MusicPage() {
  return <SpacePage spaceId="music" fullWidth afterContent={<>
    <MusicReports reports={musicReports} />
    <MusicRecordings groups={musicRecordingGroups} />
  </>}>
    <p className="space-description">Piano, favorite songs, and Eason.</p>
  </SpacePage>;
}
