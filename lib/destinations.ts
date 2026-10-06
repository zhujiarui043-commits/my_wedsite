import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { cache } from 'react';
import defaults from './journey-destinations.json';
import { journeyPlaces } from './journey-places';
import { dataRoot, writeContentFile } from './content-storage';
import type { Destination } from './destination-shared';

export async function listDestinations(): Promise<Destination[]> {
  try {
    const entries = JSON.parse(await readFile(path.join(dataRoot, 'destinations.json'), 'utf8'));
    if (!Array.isArray(entries)) throw new Error('Invalid destination data');
    return entries;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return defaults.map(destination => {
      const point = journeyPlaces.find(place => place.id === destination.slug);
      return { ...destination, country: point?.country ?? 'CHN', longitude: point?.longitude, latitude: point?.latitude };
    });
  }
}
export const findDestination = cache(async (slug: string) => (await listDestinations()).find(entry => entry.slug === slug));
export async function writeDestinations(entries: Destination[]) {
  await writeContentFile('destinations.json', entries);
}
export async function visitedPlaces() {
  const places = new Map<string, { id: string; name: string; country: string; longitude: number; latitude: number }>(journeyPlaces.map(place => [place.id, place]));
  for (const destination of await listDestinations()) {
    if (typeof destination.longitude === 'number' && typeof destination.latitude === 'number') {
      places.set(destination.slug, { id: destination.slug, name: destination.name, country: destination.country || 'CHN', longitude: destination.longitude, latitude: destination.latitude });
    }
  }
  return [...places.values()];
}
