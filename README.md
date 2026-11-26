# Fiji Spatial View

A mobile-first Cesium globe for Fiji. The initial view looks at Viti Levu (178° E, 17.8° S) from 350,000 m at a local camera pitch of −45°. Use the four bottom buttons to toggle layers. The application serves all engine code, Web Workers and fallback Fiji island geometry from Cloudflare Pages.

## Run locally

Use Node 24 and npm. Run `npm ci`, copy `.env.example` to `.env.local` and set the three browser settings. Copy the Worker settings to `worker/.dev.vars`. Run `npm run worker:dev` and `npm run dev` in separate terminals. For local development set `PAGES_ORIGIN=http://localhost:5173`. The globe opens without provider keys using the bundled island outlines from the [public-domain Natural Earth 1:50m dataset](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/). Use a browser with WebGL 2.

## Deploy on Cloudflare

1. Create an R2 bucket matching `worker/wrangler.toml`. The Worker reads it through the `SPATIAL_DATA` binding. R2 access keys are unnecessary.
2. Set the production Pages origin and comma-separated public ferry MMSIs in the Worker configuration. Add the AISstream key with `npx wrangler secret put AISSTREAM_KEY -c worker/wrangler.toml`. For authenticated OpenSky access, repeat with `OPENSKY_CLIENT_ID` and `OPENSKY_CLIENT_SECRET`.
3. Deploy the Worker with `npx wrangler deploy -c worker/wrangler.toml`. Set `VITE_API_BASE` in Pages to the resulting Worker HTTPS URL with a trailing slash. Set a URL-restricted Cesium ion token with access to World Terrain and Sentinel-2 asset 3954. Enable the Google Map Tiles API and restrict its browser key to the Pages origin. Provider attributions remain visible.
4. In Cloudflare Pages use `npm run build`, output `dist`, Node 24, and this repository root. For a direct upload, set the same build variables locally, run the build and then `npx wrangler pages deploy dist --project-name fiji-spatial-view`.
5. Verify `/ais`, `/adsb`, `/heritage/index.json` and `/leases.geojson` at the Worker. An unconfigured fleet returns 503, an absent R2 object returns 404, a working provider with no matching positions returns an empty array. Layers start off.

## Layer data

- **Ferries.** The Worker shares one AISstream socket through a Durable Object. Fiji’s island envelope is split at 180° before subscribing. Only configured ferry MMSIs appear. Positions expire after 30 minutes and the socket closes after inactivity.
- **Flights.** OpenSky supplies position snapshots. Two fixed request boxes cover the Nadi FIR. A point-in-polygon filter and aircraft ID deduplication run before the shared 60-second edge cache. Source: [ICAO APAC regional air navigation plan](https://www.icao.int/sites/default/files/APAC/APAC-ANP/APAC-ANP-Volume-I_Updated_May-2025.pdf). Provider coverage varies.
- **Heritage.** Upload a JSON array to `heritage/index.json`, with entries shaped like `{"id":"site-slug","lon":178.0,"lat":-17.8,"height":52,"radius":250}`. Height is metres above the WGS84 ellipsoid at the scan origin. Radius is the maximum camera distance in metres. For each metre-scale, Y-up, gzip-compressed SPZ v2 or v3 scan, run `node scripts/prepare-spz.mjs scan.spz 80`, replacing 80 with a bounding sphere radius enclosing the scan. Upload the .spz and its generated scan.gltf and tileset.json together under `heritage/site-slug/`. This preserves the SPZ bytes and anchors the scan in a local east-north-up frame. Only the nearest eligible site loads below 150 m above local terrain. Unknown terrain height defers loading.
- **Land.** Supply published VanuaOS or Fiji Homes boundaries as a WGS84 GeoJSON FeatureCollection of Polygon or MultiPolygon features under `leases.geojson`. Use RFC 7946 MultiPolygon parts for antimeridian crossings. Only upload approved public geometry and attributes. This adapter reads the whole collection without a spatial query.
- **Terrain.** World Terrain and Sentinel-2 stay active under a city tileset. Google requests begin inside the configured Suva/Nadi extents below 4 km camera altitude. Leaving the extent releases the tileset. Local Google coverage and imagery detail depend on the provider.

## Development and checks

The plugin contract lives in `src/layers/types.ts`. Implement `activate`, observe the context AbortSignal, and return a disposable handle. Register the plugin in the array passed to the layer bar in `src/main.ts`. Browser and Worker share spatial logic in `shared/`.

Run `npm test`, `npm run build`, and `npx wrangler deploy --dry-run -c worker/wrangler.toml`. Test the mobile UI with provider keys on a staging Pages origin before enabling public access. The upstream code license is retained in LICENSE. Runtime datasets are governed by their providers.

When OpenSky times out or rejects a request, Flights uses the [adsb.lol public API](https://www.adsb.lol/docs/open-data/api/) under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Fallback coverage is a 250 nautical mile radius around Viti Levu intersected with the Nadi FIR. The UI reports the active source, coverage and aircraft count. A provider outage is never converted to an empty snapshot.
A shared FlightFeed Durable Object coalesces refreshes across edge locations, remembers regional provider Retry-After deadlines, and tries the [adsb.fi regional API](https://github.com/adsbfi/opendata) when adsb.lol is unavailable. During a brief upstream outage, the preview labels the last successful snapshot with its UTC update time. Positions and fallback snapshots expire after ten minutes.
