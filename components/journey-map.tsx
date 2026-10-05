import geography from '@/lib/maps/east-asia.json';
import { journeyPlaces } from '@/lib/journey-places';
import JourneyMapMarkers from '@/components/journey-map-markers';

const width = 780;
const height = 540;
const padding = 18;
const radians = Math.PI / 180;
const mercatorY = (latitude: number) => Math.log(Math.tan(Math.PI / 4 + latitude * radians / 2)) / radians;
const { west, south, east, north } = geography.bounds;
const northY = mercatorY(north);
const latitudeSpan = northY - mercatorY(south);
const scale = Math.min((width - padding * 2) / (east - west), (height - padding * 2) / latitudeSpan);
const offsetX = (width - (east - west) * scale) / 2;
const offsetY = (height - latitudeSpan * scale) / 2;
const focusRegions = new Set<string>(journeyPlaces.map(place => place.country));
if (focusRegions.has('CHN')) {
  for (const region of ['TWN', 'HKG', 'MAC']) focusRegions.add(region);
}

function project(longitude: number, latitude: number) {
  return [offsetX + (longitude - west) * scale, offsetY + (northY - mercatorY(latitude)) * scale];
}

function outline(polygons: number[][][][]) {
  return polygons.flatMap(polygon => polygon.map(ring => ring.map((point, index) => {
    const [x, y] = project(point[0], point[1]);
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join('') + 'Z')).join('');
}

export default function JourneyMap() {
  return (
    <figure className="journey-map">
      <figcaption className="journey-map-caption">
        <span>PLACES I’VE BEEN</span>
        <span className="journey-map-legend"><i aria-hidden="true" />Visited</span>
      </figcaption>
      <div className="journey-map-frame">
        <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Visited places map" aria-describedby="journey-map-description">
          <desc id="journey-map-description">{`A black map covering China, Korea, and Japan, with ${journeyPlaces.length} visited cities in red. Hover or focus a red dot to see the city name.`}</desc>
          <defs>
            <clipPath id="journey-map-clip"><rect width={width} height={height} /></clipPath>
            <filter id="journey-map-glow" x="-150%" y="-150%" width="400%" height="400%">
              <feGaussianBlur stdDeviation="2.5" />
            </filter>
          </defs>
          <g clipPath="url(#journey-map-clip)">
            {geography.regions.map(region => (
              <path
                key={region.id}
                data-region={region.id}
                className={focusRegions.has(region.id) ? 'journey-map-land is-focus' : 'journey-map-land'}
                d={outline(region.polygons)}
                fillRule="evenodd"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <JourneyMapMarkers width={width} height={height} places={journeyPlaces.map(place => {
              const [x, y] = project(place.longitude, place.latitude);
              return { id: place.id, name: place.name, x, y };
            })} />
          </g>
        </svg>
      </div>
      <p className="journey-map-credit">
        <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a>
        <span aria-hidden="true"> · </span>
        <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a>
      </p>
    </figure>
  );
}
