export const spaces = [
  { id: 'about', label: 'About', href: '/about', description: 'A little about me.' },
  { id: 'journey', label: 'Journey', href: '/journey', description: 'Paths, places, and moments along the way.' },
  { id: 'gallery', label: 'Gallery', href: '/gallery', description: 'Photographs and everyday moments.' },
  { id: 'music', label: 'Music', href: '/music', description: 'Piano, favorite songs, and Eason.' },
  { id: 'notes', label: 'Notes', href: '/notes', description: 'Thoughts, ideas, and things I’m learning.' },
] as const;

export type SpaceId = (typeof spaces)[number]['id'];
