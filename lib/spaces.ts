export const spaces = [
  { id: 'about', label: 'About', href: '/about', description: 'A little about me.' },
  { id: 'gallery', label: 'Gallery', href: '/gallery', description: 'Photographs and everyday moments.' },
  { id: 'journey', label: 'Journey', href: '/journey', description: 'Paths, places, and moments along the way.' },
  { id: 'music', label: 'Music', href: '/music', description: 'Piano, favorite songs, and Eason.' },
  { id: 'notes', label: 'Guestbook', href: '/notes', description: 'A little hello, a thought, or a story from you.' },
] as const;

export type SpaceId = (typeof spaces)[number]['id'];
