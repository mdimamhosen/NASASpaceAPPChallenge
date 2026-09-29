# Mars Explorer

A Jezero Marswalk planning demo built from NASA Mars Trek imagery, curated Jezero annotations, local mission notes, and Earth-only NASA EONET events. Route scoring and watch zones are educational heuristics, not operational guidance.

## Run locally

Requirements: Node.js 20+ and pnpm 9+.

```sh
pnpm install
cp .env.example .env
cp apps/web/.env.local.example apps/web/.env.local
pnpm dev
```

Open `http://localhost:3000`; the Nest API runs on port 4000. The default assistant retrieves from `data/corpus` and assembles cited answers locally. Briefings and server PDFs are deterministic and need no model key.

For the `/eonet` Earth map, put `NEXT_PUBLIC_GOOGLE_MAP_API_KEY=your-browser-key` in `apps/web/.env.local`, enable the Maps JavaScript API for that key, and restart Next.js. The EONET event register still works without a Maps key. The key is a browser key; restrict it by HTTP referrer and API in Google Cloud. The `/explore` console uses NASA Trek in Leaflet by default and offers a Google Maps shell with NASA Trek `ImageMapType` when the same key is present. This does not use a Google Mars tile service. NASA Trek, EONET, and Google Maps need network access.

The landing, Survival, Story, Jezero, Mission, Data, Ops, Pipeline, and Architecture pages use four lazily loaded Three.js scenes. A static poster appears for reduced motion or unavailable WebGL. The Mars globe uses a [NASA/JPL Viking-derived texture](https://science.nasa.gov/3d-resources/mars/); its Jezero pin is schematic. The `/gallery` page in the running app links each image to its NASA caption and credit. The long-form theater pages have source registers and next-stop links.

Optional Claude, Gemini, and DeepSeek credentials belong only in the ignored root `.env`. The assistant uses a cloud model only after **Use cloud model** is selected in the console, or the optional `/compare` page is explicitly run. No model keys are needed for the recording path.

## Four-minute recording path

| Time | Screen | Show |
|---|---|---|
| 0:00–0:25 | `/` | Solar transfer scene and brand |
| 0:25–0:50 | `/survival` + `/jezero` | Challenge brief and textured Mars globe |
| 0:50–1:15 | `/eonet` | Google Maps with EARTH / EONET locations only |
| 1:15–2:15 | `/explore` | NASA Trek layers, demo Marswalk, route metrics and method badge |
| 2:15–2:40 | Ask + `/traces` | Local cited answer and deterministic steps |
| 2:40–3:15 | `/ops` + `/briefing/preview` | Simulated WebSocket ticks and server PDF download |
| 3:15–3:40 | `/targets` + `/hazards` | Seeded Jezero points and non-certifying watch zones |
| 3:40–4:00 | `/architecture` + `/story` + `/science` | Source boundaries, narrative, limitations |

The tour strip follows this path. `/compare` is an optional experiment outside the recording path.

## Data and methods

- [NASA Mars Trek](https://trek.nasa.gov/mars/) supplies the Mars basemap. NASA [Perseverance](https://science.nasa.gov/mission/mars-2020-perseverance/) and [Photojournal](https://science.nasa.gov/photojournal/jezero-craters-kodiak-and-scarps/) supply science context.
- `data/jezero` contains approximate, seeded points, watch zones, and reference areas. The `/pipeline` page lists the actual data path; there is no full-planet PDS ingest or live rover data.
- The default route score checks seeded polygons and points with a haversine/sample heuristic. Its badge says `HEURISTIC`.
- Optional PostGIS Jezero mode uses `ST_Intersects` and `ST_DWithin` with a Mars-local approximate kilometer scale. Run `data/jezero/postgis/001_seed.sql` against `DATABASE_URL`, then set `POSTGIS_ENABLED=true` in `.env`. The badge says `POSTGIS JEZERO`; if the DB is unavailable the route returns to the heuristic. Neither method certifies safety.
- [NASA EONET v3](https://eonet.gsfc.nasa.gov/docs/v3) supplies Earth events only. EONET geometries never appear on the Mars map.
- The local assistant pipeline retrieves notes, optionally calls the Earth EONET tool for Earth questions, grades evidence, and assembles a template answer. `/traces` shows the last request in this API process, not a persistent observability system.
- `POST /briefings/pdf` renders the deterministic briefing with PDFKit. The `/ops` WebSocket namespace broadcasts explicitly simulated ticks every three seconds.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness |
| GET | `/layers` | Mars layer catalog |
| GET | `/regions/jezero` | Seeded Jezero data |
| POST | `/routes/analyze` | Route metrics and method badge |
| POST | `/assistant/ask` | Cited local answer by default |
| GET | `/assistant/traces` | Last deterministic step log |
| POST | `/briefings` | Template briefing |
| POST | `/briefings/pdf` | Server PDF |
| GET | `/eonet/events-summary` | EARTH / EONET feed |
| WebSocket | `/ops` (`ops.tick`) | Simulated activity |

`docker compose up --build` runs the app. The optional PostGIS database profile is `docker compose --profile database up --build`; seed it with `docker compose exec -T postgres psql -U mars -d mars_explorer < data/jezero/postgis/001_seed.sql` before enabling `POSTGIS_ENABLED=true`. For Docker, set the Google Maps key in the root `.env` so Compose passes it to the web service. This project is a research storytelling aid, not flight software or navigation guidance.
# NASASpaceAPPChallenge
