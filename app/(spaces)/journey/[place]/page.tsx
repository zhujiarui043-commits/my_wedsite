import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SpacePage from '@/components/space-page';
import { findDestination } from '@/lib/destinations';

type Props = { params: Promise<{ place: string }> };

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const destination = await findDestination((await params).place);
  if (!destination) notFound();
  return {
    title: `${destination.name} | Journey | Jerry Zhu`,
    description: `Jerry Zhu’s travel journal from ${destination.name}.`,
  };
}

export default async function JourneyDestinationPage({ params }: Props) {
  const destination = await findDestination((await params).place);
  if (!destination) notFound();

  return (
    <SpacePage
      spaceId="journey"
      title={destination.name}
      backLink={{ href: '/journey', label: 'Back to Journey' }}
      media={destination.image_key ? <figure className="space-photo notes-photo"><img src={`/api/images/${destination.image_key}`} alt={destination.name} decoding="async" /></figure> : undefined}
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
