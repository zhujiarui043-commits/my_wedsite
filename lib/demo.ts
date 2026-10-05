import type { Post } from './post-shared';

export const demoPhotos: Post[] = [
  {
    id: 'demo-1', kind: 'photo', title: 'Where the light falls',
    body: 'A beam of light gives a familiar space a new shape.\n\nA sample photograph for this layout, not a photograph by Jerry.',
    image_key: 'https://images.unsplash.com/photo-1744787384973-5471a5205134?auto=format&fit=crop&w=1800&q=85',
    location: 'Architecture & light', taken_at: '2026-10-01',
    created_at: '', updated_at: '', demo: true, source: 'nahmapdj / Unsplash',
  },
  {
    id: 'demo-2', kind: 'photo', title: 'Beyond the mountains',
    body: 'By a quiet lake, leaving a little time for the horizon.\n\nA sample photograph for this layout, not a photograph by Jerry.',
    image_key: 'https://images.unsplash.com/photo-1629891616601-ee8fd85eda4f?auto=format&fit=crop&w=1800&q=85',
    location: 'In the mountains', taken_at: '2026-09-28',
    created_at: '', updated_at: '', demo: true, source: 'David Becker / Unsplash',
  },
  {
    id: 'demo-3', kind: 'photo', title: 'Small beginnings',
    body: 'The small details of everyday life deserve a closer look.\n\nA sample photograph for this layout, not a photograph by Jerry.',
    image_key: 'https://images.unsplash.com/photo-1774005371130-d6051a2aaf97?auto=format&fit=crop&w=1800&q=85',
    location: 'Everyday details', taken_at: '2026-09-24',
    created_at: '', updated_at: '', demo: true, source: 'Kristiina Klaas / Unsplash',
  },
];

export const demoJournals: Post[] = [{
  id: 'demo-note', kind: 'journal', title: 'A place for everyday life',
  body: 'There is no need to wait for a journey or a special day.\n\nA walk, a song, or a passing thought can find a place here. Photographs remember the scene; words remember the feeling.\n\nThis is a sample entry. Publish your first journal entry to replace it with your own words.',
  image_key: null, location: 'Everyday life', taken_at: '2026-10-05',
  created_at: '', updated_at: '', demo: true,
}];
