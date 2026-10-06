'use client';
import { useState } from 'react';
import { Aperture, ArrowUpRight, BookOpen, Image, MapPin } from 'lucide-react';
import type { Post } from '@/lib/post-shared';
import type { Destination } from '@/lib/destination-shared';
import type { Album } from '@/lib/album-shared';
import StudioPosts from './studio-posts';
import StudioJourney from './studio-journey';
import StudioGallery from './studio-gallery';

const sections = [
  { id: 'notes', label: 'Notes', icon: BookOpen, description: 'Write a note, with a photograph if you like.' },
  { id: 'gallery', label: 'Gallery', icon: Image, description: 'Curate your albums and select favorites for the photo planet.' },
  { id: 'journey', label: 'Journey', icon: MapPin, description: 'Keep track of your destinations, travel journals, and map dots.' },
] as const;
export default function ContentStudio({ posts, destinations, albums, error }: { posts: Post[]; destinations: Destination[]; albums: Album[]; error: string }) {
  const [active, setActive] = useState<string>('notes');
  return <div className="studio-app"><header className="studio-app-header"><div className="studio-app-brand"><Aperture size={30} /><div><strong>Jerry Studio</strong><span>YOUR WEBSITE, YOUR STORIES</span></div></div><a href="/" target="_blank" rel="noreferrer">View website<ArrowUpRight size={16} /></a></header>
    <main className="studio-workspace"><aside className="studio-sidebar"><nav aria-label="Manage website content">{sections.map(section => <button key={section.id} aria-current={active === section.id ? 'page' : undefined} onClick={() => setActive(section.id)}><section.icon size={18} />{section.label}</button>)}</nav><p>Published content is saved on this computer and shared with your local website.</p></aside>
      <div>{error ? <p className="form-error" role="alert">{error} Reload the app to try again.</p> : sections.map(section => <section key={section.id} hidden={active !== section.id} aria-label={`Manage ${section.label}`}>
        <div className="studio-section-heading"><h1>{section.label}</h1><p>{section.description}</p></div>
        {section.id === 'journey' ? <StudioJourney initialDestinations={destinations} /> : section.id === 'gallery' ? <StudioGallery initialPosts={posts} initialAlbums={albums} /> : <StudioPosts kind="journal" initialPosts={posts} />}
      </section>)}</div>
    </main>
  </div>;
}
