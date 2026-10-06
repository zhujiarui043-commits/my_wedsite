import suppliedReports from './music-reports.json';

export type ListeningTrack = { id: string; title: string; version?: string; artist: string; plays: number };
export type ListeningReport = {
  id: string;
  month: string;
  year: number;
  songCount: number;
  changePercent?: number;
  comparedWith?: string;
  lyricWord: string;
  lyricInsight: string;
  lateNight?: { date: string; time: string; period: string };
  onRepeat?: { date: string; plays: number; title: string; artist: string };
  firstListen?: { date: string; artist: string };
  favorites?: number;
  tracks: ListeningTrack[];
};

// Counts and ranking order come from the supplied monthly report screenshots.
// Preserve original song titles; interface labels remain in English.
export const musicReports: ListeningReport[] = [...suppliedReports].sort((a, b) => a.id.localeCompare(b.id));
