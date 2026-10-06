import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import LongFormExtras from '@/components/LongFormExtras';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import MissionNav from '@/components/MissionNav';
import Data3DSection from '@/components/scenes/Data3DSection';

function formatUtc(iso?: string) {
  if (!iso) return 'NOT RECORDED';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}

function loadArchiveDates() {
  const root = join(process.cwd(), '../../data');
  try {
    const places = JSON.parse(readFileSync(join(root, 'perseverance/SOURCE.json'), 'utf8')) as { retrievedAt?: string };
    const dem = JSON.parse(readFileSync(join(root, 'jezero/pds-orbital-dem-grid.json'), 'utf8')) as { retrievedAt?: string };
    const open = (() => { try { return JSON.parse(readFileSync(join(root, 'opendata/SOURCE.json'), 'utf8')) as Record<string, { retrievedAt?: string; count?: number }>; } catch { return {}; } })();
    const openDate = (key: string) => open[key] ? `${formatUtc(open[key].retrievedAt)} · ${open[key].count} records` : 'RUN pnpm refresh:opendata';
    return { places: formatUtc(places.retrievedAt), dem: formatUtc(dem.retrievedAt), catalog: openDate('catalog'), dtm: openDate('hiriseDtm'), names: openDate('iauFeatures') };
  } catch {
    return { places: 'RUN pnpm refresh:nasa', dem: 'RUN pnpm refresh:nasa', catalog: 'RUN pnpm refresh:opendata', dtm: 'RUN pnpm refresh:opendata', names: 'RUN pnpm refresh:opendata' };
  }
}

export default function SciencePage() {
  const archives = loadArchiveDates();
  const products = [
    { name: 'Mars 2020 Rover PLACES / best_interp.csv', role: 'Published rover localization, downsampled to the last ROVER record for each populated sol.', url: 'https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_rover_places/data_localizations/best_interp.csv', date: archives.places, limit: 'Interpolated localization. CSV gives sol and spacecraft clock, but no UTC observation date. It is not live telemetry. Refresh with pnpm refresh:nasa.' },
    { name: 'Mars 2020 PLACES / m20_orbital_dem.img', role: 'NASA-hosted PDS orbital DEM sampled into a 0.002° grid for elevation and approximate slope.', url: 'https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_rover_places/data_maps/m20_orbital_dem.xml', date: archives.dem, limit: 'Source pixel spacing is 1 m; app grid spacing is about 118 m. Interpolation smooths local relief. Limited to 18.416–18.508° N, 77.280–77.470° E.' },
    { name: 'NASA Mars Trek / MGS MOLA global color hillshade', role: 'Default Mars raster basemap.', url: 'https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars', date: 'Live WMTS', limit: 'Image color is visual context, not sampled route elevation.' },
    { name: 'NASA Mars Trek / Viking MDIM 2.1 color mosaic', role: 'Alternative global orbital image layer.', url: 'https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars', date: 'Live WMTS', limit: 'Tile coverage and resolution depend on zoom; image is not a hazard assessment.' },
    { name: 'NASA Mars Trek / MOLA + HRSC color and grayscale hillshade blends', role: 'Additional verified WMTS layers for regional context.', url: 'https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars', date: 'Live WMTS', limit: 'Hillshade is a rendered view; route metrics come from the separate PDS DEM grid.' },
    { name: 'NASA Mars Trek / Jezero HiRISE 25 cm and CTX 6 m orthomosaics', role: 'Imagery draped on the PLACES DEM grid in the 3D terrain view (JEZ_hirise_soc_006 and JEZ_ctx_B_soc_008 Trek layers).', url: 'https://trek.nasa.gov/mars/', date: 'Live WMTS', limit: 'Imagery is resampled to about 10 m per texture pixel and draped on the ~118 m DEM with ×1–×6 vertical exaggeration and illustrative lighting. Visual context only; not a hazard or slope measurement.' },
    { name: 'NASA JPL SSD / Keplerian elements for approximate planet positions', role: 'Earth and Mars positions, distance, and light time in the timeline orbit scene.', url: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html', date: 'Table 1 (1800–2050), bundled', limit: 'Accuracy of a few thousandths of an AU; shows geometry, not the Mars 2020 trajectory.' },
    { name: 'NASA NSSDCA / Mars mission landing sites', role: 'Approximate landing coordinates for the landing-record globe; Perseverance uses PLACES sol 0.', url: 'https://nssdc.gsfc.nasa.gov/planetary/planets/marspage.html', date: 'Bundled constants', limit: 'Rounded published coordinates for visualization, not a geodetic reference.' },
    { name: 'NASA Planetary Fact Sheet', role: 'Radius, axial tilt, sidereal day, and gravity in the Earth–Mars scale scene.', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/', date: 'Bundled constants', limit: 'Mean values; the scene shows true relative size but not true separation.' },
    { name: 'Research console corpus (public NASA pages)', role: 'Retrieval-augmented answers and the mission agent cite passages from ~20 ingested NASA pages (Perseverance, instruments, samples, PLACES, Mars Trek, EONET docs, JPL, MRO/HiRISE, other landers) plus the app methods note.', url: 'https://science.nasa.gov/mission/mars-2020-perseverance/', date: 'Per-document retrievedDate in data/corpus', limit: 'Answers are limited to indexed text; weak evidence is refused. Model output is kept only with valid passage citations.' },
    { name: 'NASA Open Data portal / data.nasa.gov datasets tagged "mars"', role: 'Searchable catalog on the Open Data page, dataset shelves on landing-site markers, and the agent tool nasa_open_data.', url: 'https://data.nasa.gov/dataset/?tags=mars', date: archives.catalog, limit: 'Catalog records describe archives (mostly PDS); mission tags are inferred from titles and descriptions. Refresh with pnpm refresh:opendata.' },
    { name: 'data.nasa.gov / MRO HiRISE DTM V1.0 footprints (PDS DTM cumulative index)', role: 'Footprint layer on the Mars map; route coverage share in the Evidence Cockpit, risk notes, and briefing.', url: 'https://data.nasa.gov/dataset/mro-mars-high-resolution-imaging-science-experiment-dtm-v1-0', date: archives.dtm, limit: 'Footprints show where 1–2 m HiRISE DTMs exist. The app does not sample their elevations; the Risk Index still uses the ~118 m PLACES grid.' },
    { name: 'data.nasa.gov / Gazetteer of Planetary Nomenclature: Mars (IAU/USGS)', role: 'Feature-name labels on the Mars map, named features along routes and in briefings, and the agent tool named_features.', url: 'https://data.nasa.gov/dataset/gazetteer-of-planetary-nomenclature-mars-mola-global-images', date: archives.names, limit: 'Center points of IAU-adopted names, not feature boundaries or landing targets. Labels thin out by feature diameter as you zoom out.' },
    { name: 'NASA EONET v3 / Earth events', role: 'Live Earth natural event metadata, source links, and category counts.', url: 'https://eonet.gsfc.nasa.gov/docs/v3', date: 'Live feed; cache time shown in UI', limit: 'Earth-only geometry. EONET is never plotted on Mars Trek.' },
    { name: 'NASA Perseverance mission', role: 'Local evidence corpus and linked mission context.', url: 'https://science.nasa.gov/mission/mars-2020-perseverance/', date: 'Original corpus retrieval not recorded', limit: 'Mission facts do not authenticate demo marker coordinates.' },
    { name: 'NASA Photojournal / Jezero Crater’s Kodiak and scarps', role: 'Orbital interpretation and image context in the local corpus.', url: 'https://science.nasa.gov/photojournal/jezero-craters-kodiak-and-scarps/', date: 'Original corpus retrieval not recorded', limit: 'Photojournal context is not a precision footprint or route safety finding.' },
  ];
  return (
    <main className="science-page min-h-screen bg-mission-bg text-mission-fg">
      <MissionNav active="/science" />
      <header>
        <Link href="/explore">RETURN TO MISSION CONSOLE</Link>
        <span>DATA ASSURANCE / 01</span>
      </header>
      <section className="science-intro">
        <p className="eyebrow">MARS EXPLORER / METHODS</p>
        <h1>Science & data verification</h1>
        <p>Every live product, retrieval date, and unresolved limit in the mission path. PLACES CSV and DEM grid dates update after <code>pnpm refresh:nasa</code>.</p>
      </section>
      <section className="science-section">
        <h2>Published product register</h2>
        <div className="source-table">
          {products.map((p) => (
            <article key={p.name}>
              <div>
                <strong>{p.name}</strong>
                <p>{p.role}</p>
                <small>RETRIEVED: {p.date}</small>
              </div>
              <p>{p.limit}</p>
              <a href={p.url} target="_blank" rel="noreferrer">
                OPEN PRODUCT <ArrowUpRight size={13} />
              </a>
            </article>
          ))}
        </div>
      </section>
      <section className="science-section">
        <h2>What the measurements can support</h2>
        <div className="method-grid">
          <article>
            <strong>Route length</strong>
            <p>Great-circle distance between sketch vertices uses a mean Mars radius of 3,390 km. It does not account for actual walking turns or obstacles.</p>
          </article>
          <article>
            <strong>Traverse Risk Index</strong>
            <p>Peak slope from the coarse PDS grid, route length, turns, and missing DTM coverage enter application-defined weights. The result is NON-CERTIFYING at every score.</p>
          </article>
          <article>
            <strong>Suggested corridor</strong>
            <p>A* searches the coarse DTM grid using slope-weighted distance. A suggested path is only a visual research aid; it does not establish traversability.</p>
          </article>
          <article>
            <strong>DEMO overlay</strong>
            <p>Approximate Jezero POIs and terrain watch polygons are off by default. When switched on they are labeled DEMO · NOT NASA PRODUCT. Schematic HiRISE rectangles are not displayed.</p>
          </article>
          <article>
            <strong>PLACES time</strong>
            <p>The downloaded localization CSV gives sol and spacecraft clock. It does not provide a UTC observation date, so the sol scrubber does not invent one.</p>
          </article>
          <article>
            <strong>Earth / EONET boundary</strong>
            <p>Earth natural events appear only in Earth views and assistant responses explicitly labeled EARTH / EONET. No Earth geometry is used in Mars risk analysis.</p>
          </article>
        </div>
      </section>
      <footer>
        <Link href="/">MARS EXPLORER</Link>
        <span>RESEARCH AID · NOT FOR OPERATIONAL NAVIGATION</span>
      </footer>
      <Data3DSection variant="stack" eyebrow="SCIENCE / SOURCE STACK" title="The register, as layers." body="The PDS DEM, the Trek HiRISE and CTX mosaics, and the PLACES localizations listed above, exploded in 3D for one Jezero tile." cta={{ href: '/explore?view=3d', label: 'OPEN IN 3D CONSOLE' }} /><LongFormExtras page="science" />
    </main>
  );
}
