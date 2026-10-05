import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { spaces, type SpaceId } from '@/lib/spaces';

export default function SpacePage({ spaceId }: { spaceId: SpaceId }) {
  const space = spaces.find(item => item.id === spaceId)!;

  return (
    <div className="space-shell">
      <header className="space-header">
        <Link className="space-home-link" href="/">
          <ArrowLeft size={18} aria-hidden="true" />
          <span>Home</span>
        </Link>
        <nav className="space-nav" aria-label="Explore my space">
          {spaces.map(item => (
            <Link key={item.id} href={item.href} aria-current={item.id === spaceId ? 'page' : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="space-main">
        <p className="space-byline">JERRY ZHU’S SPACE</p>
        <h1>{space.label}</h1>
        <p className="space-description">{space.description}</p>
        <div className="space-placeholder">
          <p>More coming soon.</p>
        </div>
      </main>
    </div>
  );
}
