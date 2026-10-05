import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SpacePage from '@/components/space-page';
import destinations from '@/lib/journey-destinations.json';

type Props = { params: Promise<{ place: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return destinations.map(destination => ({ place: destination.slug }));
}

function findDestination(slug: string) {
  const destination = destinations.find(entry => entry.slug === slug);
  if (!destination) notFound();
  return destination;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const destination = findDestination((await params).place);
  return {
    title: `${destination.name} | Journey | Jerry Zhu`,
    description: `Jerry Zhu’s travel journal from ${destination.name}.`,
  };
}

export default async function JourneyDestinationPage({ params }: Props) {
  const destination = findDestination((await params).place);

  return (
    <SpacePage
      spaceId="journey"
      title={destination.name}
      backLink={{ href: '/journey', label: 'Back to Journey' }}
    >
      <p className="space-description">
        {destination.region ? `${destination.region} · Travel journal` : 'Travel journal'}
      </p>
      {destination.paragraphs.length ? (
        <div className="journey-story">
          {destination.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>
      ) : (
        <div className="space-placeholder"><p>More coming soon.</p></div>
      )}
    </SpacePage>
  );
}
