export type MusicVideo = {
  title: string;
  src: string;
  poster?: string;
};

export type MusicRecordingGroup = {
  id: 'piano' | 'concert';
  title: string;
  description: string;
  emptyMessage: string;
  videos: MusicVideo[];
};

export const musicRecordingGroups: MusicRecordingGroup[] = [
  {
    id: 'piano',
    title: 'Piano Recordings',
    description: 'Pieces played and recorded by me.',
    emptyMessage: 'My piano recordings will appear here.',
    videos: [
      {
        title: '伤信',
        src: '/music-recordings/piano/shang-xin.mp4',
        poster: '/music-recordings/piano/shang-xin-cover.webp',
      },
      {
        title: '晴天',
        src: '/music-recordings/piano/qing-tian.mp4',
        poster: '/music-recordings/piano/qing-tian-cover.jpg',
      },
      {
        title: '你的名字',
        src: '/music-recordings/piano/ni-de-ming-zi.mp4',
        poster: '/music-recordings/piano/ni-de-ming-zi-cover.jpg',
      },
      {
        title: '十年',
        src: '/music-recordings/piano/shi-nian.mp4',
        poster: '/music-recordings/piano/shi-nian-cover.jpg',
      },
    ],
  },
  {
    id: 'concert',
    title: 'Concert Recordings',
    description: 'Moments I recorded from live shows.',
    emptyMessage: 'My concert recordings will appear here.',
    videos: [],
  },
];
