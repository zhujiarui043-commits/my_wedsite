import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import SpacePage from '@/components/space-page';
import JourneyMap from '@/components/journey-map';
import destinations from '@/lib/journey-destinations.json';
import { spaces } from '@/lib/spaces';

export const metadata: Metadata = { title: 'Journey | Jerry Zhu' };

export default function JourneyPage() {
  return (
    <SpacePage spaceId="journey" media={<JourneyMap />}>
      <p className="space-description">{spaces.find(space => space.id === 'journey')!.description}</p>
      <section className="journey-destinations" aria-labelledby="journey-destinations-heading">
        <h2 id="journey-destinations-heading">Places &amp; memories</h2>
        <nav className="journey-destination-list" aria-label="Journey destinations">
          {destinations.map(destination => (
            <Link
              key={destination.slug}
              className="journey-destination-link"
              href={`/journey/${destination.slug}`}
              aria-label={destination.region ? `${destination.region} (${destination.name})` : destination.name}
            >
              <span className="journey-destination-label">
                <span className="journey-destination-name">{destination.region ?? destination.name}</span>
                {destination.region && <span className="journey-destination-region">{destination.name}</span>}
              </span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </section>
    </SpacePage>
  );
}
