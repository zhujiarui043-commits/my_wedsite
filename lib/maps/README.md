# Journey map data

`east-asia.json` contains regional polygon subsets from Natural Earth’s 1:50m
Admin 0 Countries GeoJSON. Coordinates are rounded to four decimal places;
original boundaries are retained and clipped to the viewport when rendered.
The source URL and SHA-256 digest are recorded in the JSON.

- Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson
- License: public domain, https://www.naturalearthdata.com/about/terms-of-use/
- Viewport: 72°–147° E, 17°–55° N, including China's land area, Hainan,
  Taiwan, Hong Kong, Macao, Korea, and Japan's main islands. Southeast Asia,
  the Indian peninsula, and the South China Sea are excluded.

Regenerate the local subset with `node scripts/generate-journey-map.cjs`.
An optional first argument accepts a previously downloaded source GeoJSON.
The website renders the bundled data without runtime requests to a map service.

City coordinates in `lib/journey-places.ts` come from GeoNames:

- Shanghai: https://www.geonames.org/1796236/shanghai.html
- Osaka: https://www.geonames.org/advanced-search.html?country=JP&q=osaka
- City gazetteer used for the additional destinations: https://download.geonames.org/export/dump/cities15000.zip
- Busan: https://www.geonames.org/1838524/busan.html
- License and attribution: https://www.geonames.org/export/

GeoNames attribution is displayed below the map.
