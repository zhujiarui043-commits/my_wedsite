const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const sourceUrl = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';
const bounds = { west: 72, south: 17, east: 147, north: 55 };
const includedRegions = new Set([
  'CHN', 'TWN', 'HKG', 'MAC', 'JPN', 'KOR', 'PRK', 'MNG', 'RUS',
  'KAZ', 'KGZ', 'TJK', 'AFG', 'PAK', 'NPL', 'BTN',
]);

function intersectsRegion(ring) {
  const longitudes = ring.map(point => point[0]);
  const latitudes = ring.map(point => point[1]);
  return Math.max(...longitudes) >= bounds.west && Math.min(...longitudes) <= bounds.east
    && Math.max(...latitudes) >= bounds.south && Math.min(...latitudes) <= bounds.north;
}

async function main() {
  const raw = process.argv[2]
    ? await fs.readFile(process.argv[2], 'utf8')
    : await fetch(sourceUrl).then(response => {
      if (!response.ok) throw new Error(`Map download failed: ${response.status}`);
      return response.text();
    });
  const source = JSON.parse(raw);
  const regions = source.features.flatMap(feature => {
    if (!includedRegions.has(feature.properties.ADM0_A3)) return [];
    const polygons = (feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates)
      .filter(polygon => intersectsRegion(polygon[0]))
      .map(polygon => polygon.map(ring => ring.map(point =>
        point.slice(0, 2).map(value => Number(value.toFixed(4))))));
    if (!polygons.length) return [];
    return [{ id: feature.properties.ADM0_A3, name: feature.properties.NAME, polygons }];
  });
  const output = {
    source: sourceUrl,
    sourceSha256: crypto.createHash('sha256').update(raw).digest('hex'),
    license: 'Public domain',
    bounds,
    regions,
  };
  const destination = path.join(__dirname, '..', 'lib', 'maps', 'east-asia.json');
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, JSON.stringify(output) + '\n');
  console.log(`Generated ${regions.length} map regions (${Buffer.byteLength(JSON.stringify(output))} bytes).`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
