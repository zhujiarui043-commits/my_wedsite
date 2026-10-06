'use client';
import { useState } from 'react';
import { Globe2, Images } from 'lucide-react';
import type { Post } from '@/lib/post-shared';
import type { Album } from '@/lib/album-shared';
import StudioPosts from './studio-posts';
import StudioAlbums from './studio-albums';

export default function StudioGallery({ initialPosts, initialAlbums }: { initialPosts: Post[]; initialAlbums: Album[] }) {
  const [photos, setPhotos] = useState(initialPosts.filter(post => post.kind === 'photo'));
  const [active, setActive] = useState<'planet' | 'albums'>('planet');
  return <>
    <nav className="studio-gallery-tabs" aria-label="Manage Gallery"><button type="button" aria-current={active === 'planet' ? 'page' : undefined} onClick={() => setActive('planet')}><Globe2 size={17} />Photo planet</button><button type="button" aria-current={active === 'albums' ? 'page' : undefined} onClick={() => setActive('albums')}><Images size={17} />Albums</button></nav>
    <section hidden={active !== 'planet'} aria-label="Manage photo planet"><p className="studio-gallery-hint">Choose your favorites for the planet with “Show on photo planet”. Album photographs and planet highlights share the same likes.</p><StudioPosts kind="photo" initialPosts={photos} onPostsChange={setPhotos} /></section>
    <section hidden={active !== 'albums'} aria-label="Manage albums"><StudioAlbums initialAlbums={initialAlbums} photos={photos} onPhotosChange={setPhotos} /></section>
  </>;
}
