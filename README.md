# Mars Explorer

A source-grounded Jezero Marswalk research console. It connects NASA Mars Trek imagery, published Mars 2020 PLACES rover localizations and orbital elevation data, a cited mission assistant, and an Earth-only NASA EONET feed. Routes and the Traverse Risk Index are **non-certifying research aids**.

## Run locally

Requires Node.js 20+ and pnpm 9+.

```sh
pnpm install
cp .env.example .env
cp apps/web/.env.local.example apps/web/.env.local
pnpm dev
```

Open `http://localhost:3000`; Nest runs on port 4000. The local evidence assistant and PDF briefing work without a cloud model key. Cloud model credentials stay in the API environment and are used only after explicit opt-in. A browser-restricted Google Maps key optionally enables the Google shell; Leaflet with NASA Trek is the default Mars viewer.

The homepage and dossier pages contain 3D visual studies. Those scenes are illustrations. The Explore console is the measured-data surface.

## Published data and limits

| Product | In the app | Limit |
|---|---|---|
| [Mars 2020 PLACES `best_interp.csv`](https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_rover_places/data_localizations/best_interp.csv) | Rover track, sol scrubber, verified mission locations, classroom route | Interpolated published localization; no UTC observation date in the CSV and no live rover telemetry. |
| [PLACES `m20_orbital_dem.img`](https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_rover_places/data_maps/m20_orbital_dem.xml) | Coarse sampled elevation/slope, Risk Index, A* corridor | The app samples the 1 m source product into a ~118 m grid in Jezero. It cannot resolve local hazards. |
| [NASA Mars Trek WMTS](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars) | MOLA, Viking, and MOLA/HRSC image layers | Raster color and hillshade are context, not route measurements. |
| [NASA EONET v3](https://eonet.gsfc.nasa.gov/docs/v3) | Earth event map, source provenance, category museum, Earth assistant tool | Earth geometry never enters the Mars map or Risk Index. |
| [NASA Perseverance mission](https://science.nasa.gov/mission/mars-2020-perseverance/) | Mission facts and local cited corpus | Mission context does not validate a user-drawn route. |

`data/perseverance/SOURCE.json` records the PLACES CSV URL, retrieval time, and checksum. `scripts/build-jezero-dtm-grid.py` reproduces the sparse DEM sampling; the exact DEM label and retrieval date are in the [science register](http://localhost:3000/science). Refresh both archives from NASA with:

```sh
pnpm refresh:nasa
# or: python3 scripts/refresh-nasa-archives.py
# flags: --skip-dem | --skip-places | --force
```

The API reloads PLACES/DEM files by mtime after a refresh. The Risk Index combines coarse sampled slope, route length, turns, and missing DTM coverage using application-defined weights. Its `dtm-sample` and `heuristic` modes are both **NON-CERTIFYING**. The A* corridor is a suggestion only.

Approximate `data/jezero` points and watch polygons are **DEMO · NOT NASA PRODUCT** and off by default. Schematic HiRISE footprint boxes are not plotted. `/targets` and `/hazards` offer an explicit DEMO switch. The `/ops` WebSocket page is visibly simulated and is not part of the real-data tour.

## Explore flow

1. Inspect NASA Trek layers and the PLACES track; scrub to a published sol.
2. Load a PLACES route, draw a sketch, or run Classroom Mode. Classroom Mode forces cloud models off.
3. Review the Risk Index components and DTM coverage. For two endpoints, request an A* suggested corridor.
4. Ask the assistant, inspect citations, and generate a briefing or server PDF.
5. Copy a `/route/share` link and download its 1200 × 630 mission card SVG.

**PLAY STORY** in the tour strip advances through the twelve-stop narrative. Use the full spoken teleprompter in [docs/VIDEO_SCRIPT_4MIN.txt](docs/VIDEO_SCRIPT_4MIN.txt) (beat clock, click cues, backup lines). A short table version lives in [docs/VIDEO_SCRIPT.md](docs/VIDEO_SCRIPT.md). The tour uses a real EONET refresh where older versions showed simulated `/ops` activity.

Assistant traces persist as the last 100 records in Postgres when `DATABASE_URL` is usable, or `data/traces/assistant.json` otherwise. EONET snapshots use a durable file/Postgres cache and expose upstream fetch time, content hash, and cache status in the Earth UI.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness |
| GET | `/layers` | NASA Trek layer catalog |
| GET | `/places/perseverance?fromSol=&toSol=` | Downsampled published PLACES localizations |
| GET | `/regions/jezero?demo=true` | Verified locations; optional DEMO seeds |
| POST | `/routes/analyze` | Distance, DTM samples, coverage, Risk Index |
| POST | `/routes/suggest` | Coarse DTM A* corridor for two endpoints |
| POST | `/assistant/ask` | Cited local answer by default |
| GET | `/assistant/traces/recent` | Durable recent trace records |
| POST | `/briefings` | Deterministic briefing |
| POST | `/briefings/pdf` | PDF with Risk Index components |
| GET | `/eonet/events-summary` | EARTH / EONET feed |
| GET | `/eonet/provenance` | Source fetch time and cache state |
| WebSocket | `/ops` (`ops.tick`) | Explicitly simulated activity |

`docker compose up --build` runs the app. The [deployment guide](docs/DEPLOY.md) covers optional hosting. This project is a research storytelling aid, not flight software or navigation guidance.
