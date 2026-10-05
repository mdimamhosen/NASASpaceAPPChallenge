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

The homepage and dossier hero scenes are illustrations. Below them, each page carries a different data-driven 3D section (`Data3DSection`): DEM terrain with HiRISE/CTX imagery (landing), DEM columns (Jezero), Earth–Mars true scale (survival), PLACES space-time cube (mission), JPL-element orbit scrubber (timeline), NASA landing-site globe (data), source stack (science), PLACES elevation pillars (targets), DEM slope field (hazards), route elevation curtain (briefing), and a 3D mission card (share). The architecture hero animates the real NASA source → Nest module → web dependency flow. Checks: `node apps/web/src/lib/geo.check.ts` and `node packages/shared/src/orbits.check.ts`.

## Published data and limits

| Product | In the app | Limit |
|---|---|---|
| [Mars 2020 PLACES `best_interp.csv`](https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_rover_places/data_localizations/best_interp.csv) | Rover track, sol scrubber, verified mission locations, classroom route | Interpolated published localization; no UTC observation date in the CSV and no live rover telemetry. |
| [PLACES `m20_orbital_dem.img`](https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_rover_places/data_maps/m20_orbital_dem.xml) | Coarse sampled elevation/slope, Risk Index, A* corridor | The app samples the 1 m source product into a ~118 m grid in Jezero. It cannot resolve local hazards. |
| [NASA Mars Trek WMTS](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars) | MOLA, Viking, and MOLA/HRSC image layers | Raster color and hillshade are context, not route measurements. |
| [NASA Mars Trek Jezero orthomosaics](https://trek.nasa.gov/mars/) (HiRISE 25 cm, CTX 6 m) | Texture for the 3D terrain view and landing showcase, draped on the PLACES DEM | Resampled to ~10 m/px over a ~118 m DEM with vertical exaggeration; visual context only. |
| [JPL approximate planet positions](https://ssd.jpl.nasa.gov/planets/approx_pos.html), [NSSDCA](https://nssdc.gsfc.nasa.gov/planetary/planets/marspage.html), [Planetary Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/) | 3D orbit scrubber (timeline), NASA landing-site globe (data), Earth–Mars scale scene (survival) | Bundled constants; orbit geometry is approximate and not a trajectory. |
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

## Research console: RAG and the mission agent

`/research` has two modes over the same evidence layer.

- **Ask the corpus (RAG).** NASA pages in `data/corpus` are chunked by heading (~180 words, 40-word overlap), embedded with Gemini `gemini-embedding-001`, and indexed with BM25. Queries fuse both rankings with reciprocal rank fusion and an MMR diversity re-rank. An evidence gate refuses off-topic questions. Answers come from Gemini, fall back to Claude (official SDK, `claude-opus-5-5` with server-side refusal fallbacks), and fall back again to a deterministic extractive answer, so the console works with no keys. Only citations that point at real passages are kept.
- **Fast mode (default).** A "System One" router decides every tool in one pass. It uses TypeSafe AI's [Jev](https://developers.cloudflare.com/ai/models/typesafe/jev/) decision model on Cloudflare Workers AI when `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are set, otherwise instant deterministic rules. Independent tools run in parallel, and one streamed generation writes the answer. RAG answers stream token by token (`/rag/ask/stream`), and repeat questions return from an answer cache. The home page embeds the full console at `/#ask`.
- **Mission agent (deep mode).** The model plans and calls tools in a loop (max 8 turns): `search_knowledge`, `verified_locations`, `rover_position`, `suggest_corridor`, `analyze_route`, `earth_events` (labelled EARTH / EONET), `orbit_geometry` (JPL elements), and `create_briefing`. Tool arguments are validated server-side. Steps stream to the UI. Without a model, intent rules pick the same tools deterministically.

Grow the corpus with `pnpm ingest:corpus` (curated NASA pages, API must be running) or from the console (public URL or `.md`/`.txt`). Set `RAG_ADMIN_TOKEN` to require an `x-rag-token` header for corpus changes. Optional overrides: `RAG_GEMINI_MODEL`, `RAG_CLAUDE_MODEL`, `RAG_EMBED_MODEL`. Checks: `node apps/api/src/rag/rag.check.ts`, `node apps/api/src/agent/intents.check.ts`; retrieval quality is at `/rag/eval` (16 labelled questions).

## Explore flow

1. Inspect NASA Trek layers and the PLACES track; scrub to a published sol.
2. Load a PLACES route, draw a sketch, or run Classroom Mode. Classroom Mode forces cloud models off.
3. Review the Risk Index components, the DEM elevation/slope profile, and DTM coverage. The Evidence Cockpit compares waypoints with the PLACES rover track. Switch to **3D / DEM** to see the route draped on HiRISE/CTX imagery over the DEM and use **FLY ROUTE**. For two endpoints, request an A* suggested corridor.
4. Ask the assistant, inspect citations, and generate a briefing or server PDF.
5. Copy a `/route/share` link and download its 1200 × 630 mission card SVG.

A narrated, subtitled 4:00 walkthrough is in [`docs/video/`](docs/video/NARRATION_4MIN.md).

**PLAY STORY** in the tour strip advances through the eleven-stop narrative. Use the full spoken teleprompter in [docs/VIDEO_SCRIPT_4MIN.txt](docs/VIDEO_SCRIPT_4MIN.txt) (beat clock, click cues, backup lines). A short table version lives in [docs/VIDEO_SCRIPT.md](docs/VIDEO_SCRIPT.md). The tour uses a real EONET refresh where older versions showed simulated `/ops` activity.

Assistant traces persist as the last 100 records in Postgres when `DATABASE_URL` is usable, or `data/traces/assistant.json` otherwise. EONET snapshots use a durable file/Postgres cache and expose upstream fetch time, content hash, and cache status in the Earth UI.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness |
| GET | `/layers` | NASA Trek layer catalog |
| GET | `/places/perseverance?fromSol=&toSol=` | Downsampled published PLACES localizations |
| GET | `/regions/jezero?demo=true` | Verified locations; optional DEMO seeds |
| POST | `/routes/analyze` | Distance, DTM samples, coverage, Risk Index |
| GET | `/routes/dtm-grid` | Sampled PLACES DEM grid for the 3D terrain view |
| POST | `/routes/suggest` | Coarse DTM A* corridor for two endpoints |
| POST | `/assistant/ask` | Explore assistant on the hybrid RAG backend; returns passage citations |
| GET | `/rag/status` · `/rag/documents` | Corpus size, embedding model, generator availability |
| POST | `/rag/search` · `/rag/ask` | Hybrid retrieval (BM25 + Gemini embeddings, RRF + MMR); grounded answer with `[n]` citations |
| POST/DELETE | `/rag/documents/url` · `/rag/documents/text` · `/rag/documents/:id` | Ingest a public URL (SSRF-guarded) or text; delete user documents |
| POST | `/rag/reindex` | Rebuild the index |
| GET | `/rag/eval` · `/rag/projection?q=` | Recall@k / MRR per retrieval mode; 3D PCA of chunk embeddings |
| POST | `/agent/run` | Mission agent run (Gemini → Claude → deterministic planner) |
| GET | `/agent/stream?goal=&cloud=&mode=fast\|deep` | Server-sent events: `step` per plan/tool call, `token` answer deltas, then `done` |
| GET | `/rag/ask/stream?question=&cloud=` | Server-sent events: `passages`, `token` deltas, then `done` (cached repeats replay instantly) |
| GET | `/agent/tools` | Agent tool catalog and provider status |
| GET | `/assistant/traces/recent` | Durable recent trace records |
| POST | `/briefings` | Deterministic briefing |
| POST | `/briefings/pdf` | PDF with Risk Index components |
| GET | `/eonet/events-summary` | EARTH / EONET feed |
| GET | `/eonet/provenance` | Source fetch time and cache state |
| WebSocket | `/ops` (`ops.tick`) | Explicitly simulated activity |

`docker compose up --build` runs the app. The [deployment guide](docs/DEPLOY.md) covers optional hosting. This project is a research storytelling aid, not flight software or navigation guidance.
