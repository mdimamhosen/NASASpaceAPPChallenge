<div align="center">

<img src="docs/screenshots/00-cover.jpg" alt="Mars Explorer landing page: Mars globe with orbit rings beside the MARS EXPLORER wordmark" width="100%" />

# Mars Explorer

**Plan a walk on Mars from evidence, not guesswork.**

A source-grounded Jezero Crater research console built on published NASA data.<br/>
Draw a Marswalk, score it against NASA terrain, ask a cited AI assistant about it, and export a mission briefing.

Built by **Binary Explorers** for the NASA Space Apps Challenge.

![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=flat-square&logo=nextdotjs)
![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=flat-square&logo=nestjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-r186-000000?style=flat-square&logo=threedotjs)
![pnpm](https://img.shields.io/badge/pnpm-monorepo-F69220?style=flat-square&logo=pnpm&logoColor=white)
![NASA data](https://img.shields.io/badge/data-NASA%20PDS%20%C2%B7%20Trek%20%C2%B7%20EONET-0B3D91?style=flat-square)
![Non-certifying](https://img.shields.io/badge/terrain%20output-NON--CERTIFYING-555555?style=flat-square)

</div>

---

## Contents

1. [Demo video](#demo-video)
2. [The problem](#the-problem)
3. [What Mars Explorer does](#what-mars-explorer-does)
4. [Feature tour](#feature-tour)
5. [Architecture](#architecture)
6. [NASA data sources](#nasa-data-sources)
7. [Terrain and the Traverse Risk Index](#terrain-and-the-traverse-risk-index)
8. [RAG: the cited assistant](#rag-the-cited-assistant)
9. [Agentic AI: the mission agent](#agentic-ai-the-mission-agent)
10. [Earth lane: NASA EONET](#earth-lane-nasa-eonet)
11. [NASA Open Data (data.nasa.gov)](#nasa-open-data-datanasagov)
12. [Pages](#pages)
13. [API reference](#api-reference)
14. [Getting started](#getting-started)
15. [Configuration](#configuration)
16. [Checks and evaluation](#checks-and-evaluation)
17. [Deployment](#deployment)
18. [How we built it](#how-we-built-it)
19. [Honest limits](#honest-limits)
20. [Team](#team)

---

## Demo video

<div align="center">

<!-- Replace VIDEO_URL with the YouTube / Vimeo link, or drag the .mp4 into GitHub's README editor to get a user-attachments link. -->
<a href="VIDEO_URL"><img src="docs/screenshots/00-cover.jpg" alt="Watch the 4-minute Mars Explorer demo" width="80%" /></a>

**▶ 4:00 narrated walkthrough** · subtitles: [`docs/video/team/binary-explorers-mars-explorer.srt`](docs/video/team/binary-explorers-mars-explorer.srt)

</div>

The video tours every feature in the order a user meets it: landing → console → risk index → A* corridor → 3D fly-through → cited assistant → mission agent → RAG → EONET → 3D data stories → briefing → architecture. The spoken script is in [`docs/VIDEO_SCRIPT_4MIN.txt`](docs/VIDEO_SCRIPT_4MIN.txt) (beat clock, click cues, backup lines), with a short table version in [`docs/VIDEO_SCRIPT.md`](docs/VIDEO_SCRIPT.md).

---

## The problem

When people plan a route across Mars terrain, the answers they get are often confident, uncited and unverifiable. Generic chatbots invent coordinates, and map tools show pretty imagery without saying what is measured and what is decoration. Students, educators and space enthusiasts have no easy way to tell the difference.

Mars Explorer ties every claim to a published NASA product, shows its limits openly, and makes the AI cite its sources or decline to answer.

## What Mars Explorer does

```mermaid
flowchart LR
    A["🌍 Landing<br/>live EONET Earth feed"] --> B["🛰️ Mars Trek console<br/>Jezero Crater"]
    B --> C["✏️ Draw a Marswalk<br/>or load a PLACES route"]
    C --> D["📈 Terrain analysis<br/>DEM profile · Risk Index · A*"]
    D --> E["💬 Evidence-grounded answer<br/>with citations"]
    E --> F["📄 Export mission briefing<br/>PDF · share card"]
```

1. **Explore.** Switch between NASA Mars Trek layers over Jezero Crater and scrub sol by sol through Perseverance's published path.
2. **Plan.** Draw your own route, load a real PLACES route, or ask for a slope-aware A* corridor between two points.
3. **Analyze.** The API samples NASA's orbital elevation model along the route and returns elevation, slope, DTM coverage and a Traverse Risk Index in which every component names its source.
4. **See it in 3D.** Drape the route on HiRISE and CTX imagery over the DEM and **FLY ROUTE**.
5. **Ask.** The assistant answers from a library of NASA documents, cites each passage, and declines when the evidence doesn't cover the question.
6. **Share.** Generate a briefing, a server-rendered PDF, or a 1200 × 630 mission card link.

---

## Feature tour

### Landing: real ground, right away

| | |
|---|---|
| <img src="docs/screenshots/01-home-hirise-dem.jpg" alt="Home page with HiRISE imagery draped over NASA's elevation model" /> | <img src="docs/screenshots/02-home-ask.jpg" alt="Home page embedded research console for asking the mission" /> |
| **HiRISE on the NASA DEM.** The home page opens on real Jezero terrain, not a stock render. | **Ask the mission.** The full research console is embedded at `/#ask`. |

### Mars Trek surface console

| | |
|---|---|
| <img src="docs/screenshots/03-console-sols.jpg" alt="Explore console with Mars Trek colorized elevation layer and sol scrubber" /> | <img src="docs/screenshots/04-risk-index-profile.jpg" alt="Route loaded with Traverse Risk Index and elevation and slope profile" /> |
| **NASA Mars Trek layers, sol by sol.** MOLA, Viking and MOLA/HRSC layers, plus Perseverance's published PLACES track on a sol scrubber. | **Traverse Risk Index + profile.** Every component lists its score and source. The profile plots elevation and slope along the route. |
| <img src="docs/screenshots/05-astar-corridor.jpg" alt="A* suggested corridor between two points, labeled non-certifying" /> | <img src="docs/screenshots/06-fly-route-3d.jpg" alt="3D DEM view of the route draped on HiRISE imagery" /> |
| **A\* corridor.** Pick two points and get a slope-weighted path on the DEM grid. It is always labeled non-certifying. | **3D / DEM + FLY ROUTE.** The route draped on HiRISE 25 cm / CTX 6 m imagery over the PLACES elevation model. |
| <img src="docs/screenshots/07-cited-assistant.jpg" alt="Console assistant panel with cited passages" /> | <img src="docs/screenshots/08-briefing.jpg" alt="Command palette and one-click briefing" /> |
| **Cited assistant.** Answers about the route come with passage citations. | **⌘K palette + one-click briefing.** Every action is one keystroke away, and the route becomes a briefing in one click. |

### Research console: RAG and the mission agent

| | |
|---|---|
| <img src="docs/screenshots/09-mission-agent.jpg" alt="Mission agent streaming tool steps and answer" /> | <img src="docs/screenshots/10-rag-cited-answers.jpg" alt="RAG answer with clickable sentence citations" /> |
| **Mission agent.** A fast router picks tools in one pass, they run in parallel, and the answer streams in step by step. | **Cited answers.** Every sentence links to the passage it came from. |
| <img src="docs/screenshots/11-live-retrieval.jpg" alt="Live retrieval preview panel with keyword, semantic and hybrid modes" /> | <img src="docs/screenshots/12-ingest.jpg" alt="Adding a document to the corpus" /> |
| **Live retrieval.** Previews retrieval as you type in keyword, semantic or hybrid mode. | **Indexed in seconds.** Add a public NASA page or a `.md`/`.txt` file and it's chunked, embedded and searchable at once. |
| <img src="docs/screenshots/13-rag-eval-embedding.jpg" alt="Retrieval quality table and 3D embedding space" /> | |
| **Quality table + embedding space.** Recall@k and MRR per retrieval mode, plus a 3D PCA projection of every chunk. | |

### Earth lane

| | |
|---|---|
| <img src="docs/screenshots/14-eonet-provenance.jpg" alt="EONET Earth events map with provenance panel" /> | |
| **EARTH / EONET with full provenance.** Live wildfires, storms and volcanoes on a separate Earth map, with fetch time, content hash and sources. | |

### Every page is a 3D data story

| | | |
|---|---|---|
| <img src="docs/screenshots/15-earth-mars-scale.jpg" alt="Earth and Mars at true scale" /> | <img src="docs/screenshots/16-jezero-dem.jpg" alt="Jezero elevation as DEM columns" /> | <img src="docs/screenshots/17-places-sol-cube.jpg" alt="Perseverance traverse stacked by sol" /> |
| Earth and Mars at true scale | Jezero's elevation, cell by cell | Perseverance's traverse, stacked by sol |
| <img src="docs/screenshots/18-orbit-light-delay.jpg" alt="Orbit scrubber with light delay" /> | <img src="docs/screenshots/19-landing-globe.jpg" alt="Globe of NASA Mars landing sites" /> | <img src="docs/screenshots/20-source-stack.jpg" alt="Stacked source layers" /> |
| Earth and Mars on any day, with light delay | Every NASA landing on one globe | The source stack behind every claim |
| <img src="docs/screenshots/21-elevation-pillars.jpg" alt="PLACES elevation pillars" /> | <img src="docs/screenshots/22-slope-field.jpg" alt="DEM slope field" /> | <img src="docs/screenshots/23-elevation-curtain.jpg" alt="Route elevation curtain" /> |
| Perseverance's climb, in published elevations | Slopes in measured relief | A route raised into an elevation curtain |

### Briefing, traces, architecture and story

| | |
|---|---|
| <img src="docs/screenshots/24-mission-card.jpg" alt="Shareable mission card showing 6.69 km route" /> | <img src="docs/screenshots/25-traces-pipeline.jpg" alt="Traces page recording assistant runs" /> |
| **Mission card.** A server PDF and a 1200 × 630 share card for every route. | **Traces.** Every assistant run is recorded: question, tools, passages, answer. |
| <img src="docs/screenshots/26-architecture.jpg" alt="Animated architecture view of NASA data flowing through the system" /> | <img src="docs/screenshots/27-gallery.jpg" alt="NASA image gallery" /> |
| **Pipeline + architecture.** Animates the real NASA source → Nest module → web dependency flow. | **Gallery.** NASA images with full captions. |
| <img src="docs/screenshots/28-analog.jpg" alt="Earth analog questions page" /> | <img src="docs/screenshots/29-end-card.jpg" alt="Mars Explorer by Binary Explorers end card" /> |
| **Compare + analogs.** Model comparisons and Earth analog questions ("an analogy is a question, not a transfer"). | **Guided tour.** PLAY STORY walks the eleven-stop narrative. |

---

## Architecture

### System overview

```mermaid
flowchart TB
    subgraph NASA["NASA sources"]
        TREK["Mars Trek WMTS<br/>MOLA · Viking · HRSC<br/>HiRISE · CTX"]
        PDS["PDS Geosciences<br/>Mars 2020 PLACES<br/>best_interp.csv · m20_orbital_dem"]
        EONET["EONET v3 API<br/>Earth events"]
        JPL["JPL SSD · NSSDCA<br/>orbits · fact sheets"]
        PAGES["NASA mission pages<br/>science.nasa.gov"]
        OPEN["data.nasa.gov · tag mars<br/>CKAN catalog · HiRISE DTM index<br/>IAU nomenclature"]
    end

    subgraph DATA["data/ (versioned, checksummed)"]
        PERS["perseverance/<br/>PLACES CSV + SOURCE.json"]
        DTM["DEM grid<br/>~118 m sampled"]
        CORPUS["corpus/<br/>22 NASA docs"]
        RAGIDX["rag/index.json<br/>BM25 + embeddings"]
        ECACHE["eonet/ cache"]
        ODATA["opendata/<br/>catalog · DTM footprints · IAU names"]
    end

    subgraph API["apps/api · NestJS (port 4000)"]
        LAYERS[layers]
        PLACES[places]
        REGIONS[regions]
        ROUTES["routes<br/>DTM · Risk Index · A*"]
        EON[eonet]
        RAG["rag<br/>retrieve · answer · ingest"]
        AGENT["agent<br/>router · tools · traces"]
        OPENMOD["opendata<br/>catalog search · map layers · route context"]
        BRIEF["briefings<br/>JSON · PDF"]
        OPS["ops (simulated WS)"]
    end

    subgraph LLM["Model providers (server-side keys)"]
        GEM["Gemini<br/>primary + embeddings"]
        CLA["Claude<br/>fallback"]
        DET["Deterministic<br/>extractive fallback"]
    end

    subgraph WEB["apps/web · Next.js (port 3000)"]
        LAND["Landing + EONET"]
        EXP["Explore console<br/>Leaflet + Trek tiles"]
        R3D["3D scenes<br/>three.js / R3F"]
        RES["Research console"]
        BRW["Briefing + share"]
    end

    SHARED[["packages/shared<br/>contracts · types · orbits"]]

    TREK --> LAYERS
    PDS -->|refresh:nasa| PERS & DTM
    PAGES -->|ingest:corpus| CORPUS
    EONET --> EON
    JPL --> SHARED
    OPEN -->|refresh:opendata| ODATA --> OPENMOD
    OPEN -.live search.-> OPENMOD
    OPENMOD --> ROUTES
    OPENMOD --> EXP

    PERS --> PLACES
    DTM --> ROUTES
    CORPUS --> RAGIDX --> RAG
    EON <--> ECACHE

    RAG --> GEM -.fails.-> CLA -.fails.-> DET
    AGENT --> RAG & ROUTES & PLACES & REGIONS & EON & BRIEF & OPENMOD

    LAYERS & PLACES & REGIONS & ROUTES --> EXP
    ROUTES --> R3D
    EON --> LAND
    RAG & AGENT --> RES
    BRIEF --> BRW
    SHARED -.types.-> API & WEB
```

### Monorepo layout

```text
.
├── apps/
│   ├── api/                 NestJS API, one module per domain
│   │   └── src/
│   │       ├── health/      liveness
│   │       ├── layers/      NASA Trek layer catalog
│   │       ├── places/      Mars 2020 PLACES rover localizations
│   │       ├── regions/     Jezero verified locations (+ opt-in DEMO seeds)
│   │       ├── routes/      DTM sampling, Risk Index, A* corridor, DTM grid
│   │       ├── eonet/       EONET v3 client + durable cache + provenance
│   │       ├── rag/         chunk · embed · BM25 · RRF · MMR · answer · ingest (SSRF-guarded)
│   │       ├── agent/       assistant, mission agent, Jev/rules router, tools, traces
│   │       ├── opendata/    data.nasa.gov catalog search, IAU names, HiRISE DTM footprints, route context
│   │       ├── briefings/   deterministic briefing + PDF
│   │       ├── ops/         explicitly simulated WebSocket feed
│   │       ├── config/      env validation
│   │       └── common/      shared data paths
│   └── web/                 Next.js 15 + React 19 + Tailwind + three.js
│       └── src/app/         one folder per page (see Pages)
├── packages/shared/         contracts and types shared by api + web, JPL orbit math
├── data/
│   ├── perseverance/        PLACES CSV + SOURCE.json (URL, retrieval time, sha256)
│   ├── corpus/              NASA documents for RAG
│   ├── opendata/            data.nasa.gov snapshots + SOURCE.json (URL, retrieval time, sha256)
│   ├── jezero/              DEMO seeds (NOT NASA PRODUCT, off by default)
│   ├── eonet/ rag/ traces/  caches and indexes (gitignored, rebuilt)
│   └── layers.json          Trek layer catalog
├── scripts/                 refresh NASA archives, rebuild DTM grid, ingest corpus
└── docs/                    deploy guide, video scripts, screenshots, team
```

### Request lifecycle: analyzing a route

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant W as Web (Explore)
    participant R as API · routes
    participant D as DTM service
    participant G as API · regions
    U->>W: draw waypoints / load PLACES route
    W->>R: POST /routes/analyze {waypoints}
    R->>D: sample DEM along each segment
    D-->>R: elevation + slope samples, coverage %
    R->>G: verified Jezero locations
    G-->>R: POIs within 0.5 km of route
    R-->>W: distance, Risk Index components + sources,<br/>profile, coverage, certifying:false
    W-->>U: profile chart · Risk Index · 3D drape
```

---

## NASA data sources

| Product | Direct link | Used for | Limit |
|---|---|---|---|
| Mars 2020 PLACES rover localizations | [`best_interp.csv`](https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_rover_places/data_localizations/best_interp.csv) | Rover track, sol scrubber, verified locations, classroom route | Interpolated published localization. No UTC date in the CSV, no live telemetry. |
| Mars 2020 PLACES orbital DEM | [`m20_orbital_dem`](https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_rover_places/data_maps/m20_orbital_dem.xml) | Elevation/slope sampling, Risk Index, A* corridor, 3D terrain | 1 m source sampled to a ~118 m grid. Cannot resolve local hazards. |
| PDS Geosciences PLACES bundle | [places.htm](https://pds-geosciences.wustl.edu/missions/mars2020/places.htm) | Bundle documentation | — |
| NASA Mars Trek WMTS | [Trek API](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars) | MOLA, Viking, MOLA/HRSC map layers | Raster color and hillshade are context, not measurements. |
| Mars Trek Jezero orthomosaics | [trek.nasa.gov/mars](https://trek.nasa.gov/mars/) | HiRISE 25 cm / CTX 6 m texture for 3D views | Resampled to ~10 m/px with vertical exaggeration. Visual only. |
| NASA EONET v3 | [API](https://eonet.gsfc.nasa.gov/api/v3) · [docs](https://eonet.gsfc.nasa.gov/docs/v3) | Earth events map, provenance, Earth agent tool | Earth geometry never enters the Mars map or Risk Index. |
| **data.nasa.gov** Mars catalog (tag `mars`) | [data.nasa.gov/dataset/?tags=mars](https://data.nasa.gov/dataset/?tags=mars) | Open Data page, landing-site data shelves, agent tool `nasa_open_data` | 1,321 catalog records, mostly PDS archive pointers. Mission tags are inferred. |
| **data.nasa.gov** MRO HiRISE DTM V1.0 | [dataset](https://data.nasa.gov/dataset/mro-mars-high-resolution-imaging-science-experiment-dtm-v1-0) · [PDS index](https://hirise-pds.lpl.arizona.edu/PDS/INDEX/DTMCUMINDEX.TAB) | 1,315 DTM footprints on the Mars map, route DTM coverage | Shows where 1–2 m DTMs exist; their elevations are not sampled. |
| **data.nasa.gov** Gazetteer of Planetary Nomenclature: Mars | [dataset](https://data.nasa.gov/dataset/gazetteer-of-planetary-nomenclature-mars-mola-global-images) · [IAU/USGS](https://planetarynames.wr.usgs.gov/) | 2,052 IAU feature labels on the map, named features on routes and briefings, agent tool `named_features` | Center points, not boundaries. |
| JPL approximate planet positions | [ssd.jpl.nasa.gov](https://ssd.jpl.nasa.gov/planets/approx_pos.html) | Orbit scrubber, light delay | Approximate; not a trajectory. |
| NSSDCA | [Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/) · [Mars](https://nssdc.gsfc.nasa.gov/planetary/planets/marspage.html) | Earth–Mars scale, landing globe | Bundled constants. |
| NASA mission pages | [Perseverance](https://science.nasa.gov/mission/mars-2020-perseverance/) and 20 more in [`data/corpus`](data/corpus) | RAG corpus for the cited assistant | Mission context does not validate a user-drawn route. |

<details>
<summary><b>Full RAG corpus link list</b></summary>

- https://science.nasa.gov/mission/mars-2020-perseverance/
- https://science.nasa.gov/mission/mars-2020-perseverance/science/
- https://science.nasa.gov/mission/mars-2020-perseverance/science-instruments/
- https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/
- https://science.nasa.gov/mission/mars-2020-perseverance/mars-rock-samples/
- https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/
- https://science.nasa.gov/mission/mars-reconnaissance-orbiter/
- https://science.nasa.gov/mission/msl-curiosity/
- https://science.nasa.gov/mission/insight/
- https://science.nasa.gov/mission/viking-1/
- https://science.nasa.gov/mars/facts/
- https://eonet.gsfc.nasa.gov/what-is-eonet
- https://eonet.gsfc.nasa.gov/docs/v3
- https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars
- https://pds-geosciences.wustl.edu/missions/mars2020/index.htm
- https://pds-geosciences.wustl.edu/missions/mars2020/places.htm
- https://ssd.jpl.nasa.gov/planets/approx_pos.html
- https://www.uahirise.org/epo/about/ (University of Arizona, HiRISE team)

</details>

### Provenance and refresh

`data/perseverance/SOURCE.json` records the PLACES CSV URL, label URL, retrieval time, sha256 checksum and coordinate system. `scripts/build-jezero-dtm-grid.py` reproduces the DEM sampling. The `/science` page is the source register, listing each product with its retrieval date.

```sh
pnpm refresh:nasa                      # re-download PLACES + DEM from NASA PDS
pnpm refresh:opendata                  # re-snapshot data.nasa.gov catalog, HiRISE DTM index, IAU names
python3 scripts/refresh-nasa-archives.py --skip-dem | --skip-places | --force
```

The API reloads PLACES and DEM files by mtime after a refresh, so no restart is needed.

---

## Terrain and the Traverse Risk Index

`POST /routes/analyze` samples the PLACES orbital DEM along every route segment and builds a 0–100 index from four components. Each one carries its source:

| Component | Score | Source |
|---|---|---|
| Peak sampled grid slope | `min(38, maxSlope° × 2.5)` | PLACES orbital DEM (only when ≥ 80 % of samples fall inside the grid) |
| Traverse length | `min(22, km × 3)` | Great-circle distance, Mars mean radius 3390 km |
| Route complexity | `min(12, interior waypoints × 2)` | Application heuristic |
| Missing DTM coverage | `(1 − coverage) × 45` | PLACES orbital DEM |

- **`dtm-sample` mode** is used when ≥ 80 % of the route is covered by the DEM grid. Otherwise the mode is **`heuristic`** and the index makes no slope claim.
- **A\* corridor** (`POST /routes/suggest`): slope-weighted distance search on the same coarse grid.
- Every response carries `certifying: false`. The weights are application heuristics, **not an EVA safety assessment**.

---

## RAG: the cited assistant

```mermaid
flowchart LR
    subgraph Ingest
        S["NASA page URL<br/>or .md / .txt"] --> G{"SSRF guard<br/>public URLs only"}
        G --> C["Chunk by heading<br/>~180 words · 40 overlap"]
        C --> E["Gemini embedding<br/>gemini-embedding-001"]
        C --> B["BM25 index"]
    end
    subgraph Query
        Q["Question"] --> K["BM25 ranking"]
        Q --> V["Vector ranking"]
        K & V --> F["Reciprocal rank fusion"]
        F --> M["MMR diversity re-rank"]
        M --> GATE{"Evidence gate"}
        GATE -- off-topic --> REF["Decline:<br/>not in NASA sources"]
        GATE -- grounded --> GEN["Generate with [n] citations"]
    end
    E --> V
    B --> K
    GEN --> P1["Gemini"] -. fails .-> P2["Claude"] -. fails .-> P3["Deterministic extractive answer"]
    P1 & P2 & P3 --> CHK["Keep only citations that<br/>point at real passages"]
    CHK --> OUT["Streamed answer<br/>+ clickable passages"]
```

- **Hybrid retrieval.** BM25 and embedding rankings are fused with RRF, then MMR re-ranks for diversity, so one document can't fill the whole context.
- **Evidence gate.** Off-topic questions are refused instead of answered from the model's general knowledge.
- **Three-level fallback.** Gemini is tried first, then Claude, then a deterministic extractive answer, so the console still works with **no API keys at all**.
- **Citation check.** Any `[n]` that doesn't map to a retrieved passage is removed.
- **Streaming and caching.** `/rag/ask/stream` sends passages first, then token deltas. Repeat questions are served from an answer cache.
- **Grow the corpus** with `pnpm ingest:corpus` or from the console UI. Set `RAG_ADMIN_TOKEN` to protect corpus changes with an `x-rag-token` header.
- **Measured.** `/rag/eval` runs 16 labelled questions and reports Recall@k and MRR for keyword, semantic and hybrid modes.

---

## Agentic AI: the mission agent

The research console offers two agent modes over the same tools.

```mermaid
flowchart TB
    GOAL["User goal<br/>'Plan a short walk from the landing site to the delta and brief me'"] --> MODE{mode}
    MODE -- fast --> ROUTER["System One router<br/>Jev on Cloudflare Workers AI<br/>or deterministic intent rules"]
    ROUTER --> PAR["Run independent tools in parallel"]
    PAR --> GEN1["One streamed generation"]
    MODE -- deep --> LOOP["Plan → call tool → observe<br/>max 8 turns"]
    LOOP --> LOOP
    LOOP --> GEN2["Final cited answer"]

    subgraph TOOLS["Validated server-side tools"]
        T1[search_knowledge]
        T2[verified_locations]
        T3[rover_position]
        T4[suggest_corridor]
        T5[analyze_route]
        T6["earth_events<br/>(labelled EARTH / EONET)"]
        T7["orbit_geometry<br/>(JPL elements)"]
        T8[create_briefing]
        T9["nasa_open_data<br/>(data.nasa.gov)"]
        T10["named_features<br/>(IAU gazetteer)"]
    end
    PAR -.-> TOOLS
    LOOP -.-> TOOLS
    GEN1 & GEN2 --> SSE["SSE stream to UI:<br/>step · token · done"]
    SSE --> TRACE[("Trace store<br/>Postgres or data/traces")]
```

- **Fast mode (default).** One routing pass decides every tool. It uses TypeSafe AI's Jev decision model when `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are set, and instant deterministic rules otherwise.
- **Deep mode.** The model plans and calls tools in a loop of up to 8 turns. Each step streams to the UI as it happens.
- **Safety.** Tool arguments are validated server-side. Earth tool output is always labelled **EARTH / EONET** and never placed on the Mars map.
- **No-key operation.** Without a model, intent rules pick the same tools deterministically.
- **Traces.** The last 100 runs persist to Postgres when `DATABASE_URL` is usable, otherwise to `data/traces/assistant.json`. They are viewable at `/traces`.

---

## Earth lane: NASA EONET

EONET v3 is **Earth-only**, so Mars Explorer gives it its own lane:

- Live open events (wildfires, severe storms, volcanoes and more) on a separate Earth map (Google Maps with a browser-restricted key, or an OpenStreetMap fallback).
- **Provenance panel:** upstream fetch time, content hash, cache status and original sources for every snapshot.
- A durable file/Postgres cache absorbs EONET outages.
- Earth geometries are **never** plotted on the Mars Trek map and never enter the Risk Index.

---

## NASA Open Data (data.nasa.gov)

Mars Explorer uses the [NASA Open Data portal's Mars datasets](https://data.nasa.gov/dataset/?tags=mars) in five places:

| Where | What it does | data.nasa.gov dataset |
|---|---|---|
| **Main Mars map** · `IAU feature names` layer (on by default) | Labels craters, valles and montes. Small features appear as you zoom in, and a screen-space declutter keeps labels readable. | Gazetteer of Planetary Nomenclature: Mars |
| **Main Mars map** · `HiRISE DTM footprints` layer | Draws the outline of every HiRISE Digital Terrain Model. Click one for its stereo pair, post spacing and PDS directory. | MRO HiRISE DTM V1.0 |
| **Main Mars map** · `Mission landing sites` layer | Shows each NASA lander with its number of catalog datasets. Click one to open its data shelf. | Mars catalog (1,321 records) |
| **Route analysis + briefing** | Lists the IAU-named features a route crosses and the share of the route covered by each HiRISE DTM. The Evidence Cockpit, risk notes, Markdown/PDF briefing and citations all carry them. | Gazetteer + HiRISE DTM |
| **`/opendata` page** | Searches all 1,321 records (from the snapshot or live from the data.nasa.gov CKAN API) with mission facets and provenance. | Mars catalog |
| **Mission agent** | `nasa_open_data` finds datasets for a mission or instrument. `named_features` returns official names near a point. | Mars catalog + Gazetteer |
| **RAG corpus** | `data/corpus/nasa-open-data-mars.md` is generated from the snapshots so the assistant can cite them. | All three |

**Robust by design:** every product is snapshotted with its sha256 in `data/opendata/SOURCE.json`, so the app works offline. Live search times out after 8 s, is cached for 10 minutes, and falls back to the snapshot with a visible note. Snapshot files reload by mtime after `pnpm refresh:opendata`, and route analysis never fails because of open-data context.

---

## Pages

| Route | What it shows |
|---|---|
| `/` | Landing: HiRISE-on-DEM terrain, embedded research console (`/#ask`), EONET teaser |
| `/explore` | Mars Trek surface console: layers, PLACES track, draw route, Risk Index, A*, 3D, assistant, briefing |
| `/research` | RAG (ask the corpus) and mission agent (fast / deep), live retrieval, ingest, eval, embedding space |
| `/eonet` | EARTH / EONET event map with provenance |
| `/survival` | Earth–Mars true scale |
| `/jezero` | Jezero DEM columns and verified locations |
| `/mission` | PLACES space-time cube: traverse stacked by sol |
| `/timeline` | JPL-element orbit scrubber with light delay |
| `/data` | NASA landing-site globe |
| `/science` | Source register: every product, link, retrieval date and limit |
| `/opendata` | NASA Open Data: products used in the app, searchable data.nasa.gov Mars catalog, mission data shelves |
| `/targets` | PLACES elevation pillars (explicit DEMO switch) |
| `/hazards` | DEM slope field (explicit DEMO switch) |
| `/briefing` | Route elevation curtain, briefing and server PDF |
| `/route/share` | Shareable route link + 1200 × 630 mission card SVG |
| `/traces` | Recorded assistant runs |
| `/pipeline` | What the system holds: data products, corpus, index |
| `/architecture` | Animated NASA source → Nest module → web flow |
| `/gallery` | NASA images with captions |
| `/compare` | Model comparisons |
| `/analog` | Earth analog questions |
| `/story` | Guided eleven-stop narrative (PLAY STORY) |
| `/ops` | Explicitly **simulated** WebSocket activity, not part of the real-data tour |

---

## API reference

Base URL: `http://localhost:4000`

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness |
| GET | `/health/ready` | Readiness: every data product with size and age; 503 if a required one is missing |
| GET | `/opendata/catalog?q=&mission=&limit=&offset=&source=snapshot\|live` | Search the data.nasa.gov Mars catalog, with mission facets and provenance |
| GET | `/opendata/catalog/:id` | One catalog record |
| GET | `/opendata/features?south=&west=&north=&east=&zoom=` | IAU feature names in view, decluttered for the zoom |
| GET | `/opendata/features/near?lat=&lon=` | Nearest IAU feature names |
| GET | `/opendata/hirise-dtm?south=&west=&north=&east=` | HiRISE DTM footprints in view |
| GET | `/opendata/landings` | NASA landing sites with data.nasa.gov dataset counts |
| GET | `/opendata/products` | Snapshotted products with URL, retrieval time and sha256 |
| GET | `/layers` | NASA Trek layer catalog |
| GET | `/places/perseverance?fromSol=&toSol=` | Downsampled published PLACES localizations |
| GET | `/regions/jezero?demo=true` | Verified locations; optional DEMO seeds |
| POST | `/routes/analyze` | Distance, DTM samples, coverage, Risk Index |
| GET | `/routes/dtm-grid` | Sampled PLACES DEM grid for the 3D terrain view |
| POST | `/routes/suggest` | Coarse DTM A* corridor for two endpoints |
| POST | `/assistant/ask` | Explore assistant on the hybrid RAG backend, with passage citations |
| GET | `/assistant/traces/recent` | Durable recent trace records |
| GET | `/rag/status` · `/rag/documents` | Corpus size, embedding model, generator availability |
| POST | `/rag/search` · `/rag/ask` | Hybrid retrieval; grounded answer with `[n]` citations |
| GET | `/rag/ask/stream?question=&cloud=` | SSE: `passages`, `token` deltas, `done` |
| POST / DELETE | `/rag/documents/url` · `/rag/documents/text` · `/rag/documents/:id` | Ingest a public URL (SSRF-guarded) or text; delete user documents |
| POST | `/rag/reindex` | Rebuild the index |
| GET | `/rag/eval` · `/rag/projection?q=` | Recall@k / MRR per mode; 3D PCA of chunk embeddings |
| POST | `/agent/run` | Mission agent run (Gemini → Claude → deterministic planner) |
| GET | `/agent/stream?goal=&cloud=&mode=fast\|deep` | SSE: `step` per plan/tool call, `token` deltas, `done` |
| GET | `/agent/tools` | Tool catalog and provider status |
| POST | `/briefings` | Deterministic briefing |
| POST | `/briefings/pdf` | PDF with Risk Index components |
| GET | `/eonet/events-summary` | EARTH / EONET feed |
| GET | `/eonet/provenance` | Source fetch time and cache state |
| WebSocket | `/ops` (`ops.tick`) | Explicitly simulated activity |

<details>
<summary><b>Example: analyze a route</b></summary>

```sh
curl -s localhost:4000/routes/analyze \
  -H 'content-type: application/json' \
  -d '{"waypoints":[{"id":"a","lat":18.4447,"lon":77.4508},{"id":"b","lat":18.4600,"lon":77.4200}]}' | jq '.riskIndex'
```

```sh
curl -N "localhost:4000/agent/stream?goal=Where%20is%20Perseverance%20now%3F&mode=fast"
```

</details>

---

## Getting started

**Requirements:** Node.js 20+ (Node 22.16 for deployment, see `.node-version`), pnpm 9+, and Python 3 (only for refreshing NASA archives).

```sh
git clone https://github.com/mdimamhosen/NASASpaceAPPChallenge.git
cd NASASpaceAPPChallenge
pnpm install
cp .env.example .env
cp apps/web/.env.local.example apps/web/.env.local
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:4000/health

**No keys needed to start.** The local evidence assistant, deterministic agent, Risk Index and PDF briefing all work offline from the checked-in data. Cloud models are used only after explicit opt-in in the UI, and their keys stay on the API.

**Docker:**

```sh
docker compose up --build
```

### Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Build shared contracts, run web + API in watch mode |
| `pnpm build` | Production build of shared → api → web |
| `pnpm lint` | Lint web and API |
| `pnpm refresh:nasa` | Re-download PLACES and DEM from NASA PDS |
| `pnpm ingest:corpus` | Ingest the curated NASA page list into RAG (API must be running) |
| `pnpm refresh:opendata` | Re-snapshot data.nasa.gov products and regenerate the open-data corpus note |

---

## Configuration

All secrets live in the root `.env` and are read **only by the API**. The browser receives only `NEXT_PUBLIC_*` values.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | API port |
| `CORS_ORIGINS` / `WEB_ORIGIN` | `http://localhost:3000` | Allowed web origins |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | API base URL for the web app |
| `EONET_BASE_URL` | `https://eonet.gsfc.nasa.gov/api/v3` | EONET endpoint |
| `EONET_CACHE_TTL_SEC` / `EONET_DEFAULT_*` | `120` / `open`, `50`, `30` | Cache TTL, status, limit, days |
| `GOOGLE_GENERATIVE_AI_API_KEY` | — | Gemini (primary LLM + embeddings) |
| `ANTHROPIC_API_KEY` | — | Claude (fallback LLM) |
| `RAG_GEMINI_MODEL` / `RAG_CLAUDE_MODEL` / `RAG_EMBED_MODEL` | `gemini-2.5-flash` / `claude-opus-5-5` / `gemini-embedding-001` | Model overrides |
| `RAG_ADMIN_TOKEN` | — | Require `x-rag-token` for corpus changes |
| `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` / `JEV_MODEL` | — / — / `typesafe/jev` | Jev router for agent fast mode |
| `DATABASE_URL` | local Postgres | Traces + EONET cache (falls back to files) |
| `POSTGIS_ENABLED` | `false` | Optional seeded Jezero spatial profile |
| `NASA_API_KEY` | `DEMO_KEY` | NASA API key |
| `NEXT_PUBLIC_GOOGLE_MAP_API_KEY` | — | Browser-restricted Maps key for the Earth map (OSM fallback without it) |
| `RATE_LIMIT_PER_MIN` | `240` | Per-client request budget. AI endpoints are capped at 20/min and corpus changes at 10/min. |

---

## Checks and evaluation

```sh
node apps/api/src/rag/rag.check.ts           # chunking, BM25, RRF, MMR, citation filtering
node apps/api/src/agent/intents.check.ts     # deterministic intent routing
node apps/web/src/lib/geo.check.ts           # great-circle distance, geometry
node packages/shared/src/orbits.check.ts     # JPL orbit math
node apps/api/src/opendata/opendata.check.ts # data.nasa.gov snapshots, search, declutter, route context
curl -s localhost:4000/rag/eval | jq         # Recall@k and MRR on 16 labelled questions
```

---

## Deployment

The [deployment guide](docs/DEPLOY.md) covers the full setup:

- **API → Render** with the [`render.yaml`](render.yaml) blueprint (Free plan, no database required).
- **Web → Vercel** with root directory `apps/web` and source files outside the root directory included, so the build can read `packages/shared`.
- Set `NEXT_PUBLIC_API_URL` on Vercel and `CORS_ORIGINS` on Render, then run the smoke script in the guide.

---

## How we built it

```mermaid
timeline
    title From question to cited answer
    Research : Pick Jezero Crater and Perseverance as the focus
             : Find NASA products that are published, citable and freely downloadable
    Data     : Download PLACES CSV + orbital DEM from PDS, record checksums
             : Sample the DEM to a ~118 m grid, catalog Trek layers
             : Curate the NASA page corpus
    Build    : Shared contracts first, then one Nest module per domain
             : Explore console, Risk Index, A* corridor, 3D DEM drape
             : Hybrid RAG with citation checking and three-level fallback
             : Mission agent with validated tools and streamed traces
    Verify   : Label every heuristic NON-CERTIFYING, every DEMO seed NOT NASA PRODUCT
             : Keep Earth data in its own lane
             : Retrieval eval, unit checks, QA pass on every page
    Tell     : 3D data story on every page
             : 4-minute narrated, subtitled walkthrough
```

**Design principles we held to:**

1. **Every fact has a source.** Coordinates, elevations and mission facts link back to a NASA product. The `/science` page lists them all.
2. **Heuristics say so.** The Risk Index, A* corridor and DEMO seeds are labelled where they appear, not in a footnote.
3. **The AI can say "I don't know".** The evidence gate refuses questions that aren't supported by evidence, and unsupported citations are removed.
4. **Works with zero keys.** Judges, teachers and students can run it offline, and cloud models are an opt-in upgrade.
5. **Secrets stay on the server.** The browser never sees a model key.
6. **Earth is Earth.** EONET data never crosses onto the Mars map.

**Visual language:** a black, white and gray mission-console look with square corners. Mars color appears only where it comes from data.

---

## Honest limits

> Mars Explorer is a research and storytelling aid. It is **not** flight software, navigation guidance or an EVA safety assessment.

- The DEM grid is **~118 m**, too coarse to see rocks, sand traps or small scarps.
- PLACES positions are **published, interpolated localizations**, not live telemetry, and the CSV has no UTC dates.
- HiRISE/CTX imagery in 3D is **resampled with vertical exaggeration** and is visual context only.
- Risk Index weights are **application heuristics**.
- `data/jezero` points and watch polygons are **DEMO · NOT NASA PRODUCT** and are off by default.
- `/ops` is **visibly simulated**.
- Orbit geometry uses **approximate JPL elements**, not trajectories.

---

## Team

<table>
<tr>
<td align="center" width="33%">
<img src="docs/team/imam.jpg" width="160" alt="Md Imam Hosen" /><br/>
<b>Md Imam Hosen</b><br/>
<sub>Team lead · System architect · Full-stack AI engineer</sub><br/>
<sub>Architected and built the console, the retrieval engine and the AI agents.</sub>
</td>
<td align="center" width="33%">
<img src="docs/team/ahad.jpg" width="160" alt="Ahad" /><br/>
<b>Ahad</b><br/>
<sub>Researcher · NASA data analyst</sub><br/>
<sub>Sourced and verified every dataset.</sub>
</td>
<td align="center" width="33%">
<img src="docs/team/biswadev.jpg" width="160" alt="Biswadev Biswas" /><br/>
<b>Biswadev Biswas</b><br/>
<sub>3D & UI designer · QA tester</sub><br/>
<sub>Shaped the visuals and tested every feature.</sub>
</td>
</tr>
</table>

<div align="center">

**Real NASA data. Honest limits. Answers you can trace.**

*Mars Explorer, from Binary Explorers.*

</div>

---

<sub>Imagery and data courtesy of NASA, JPL-Caltech, the PDS Geosciences Node, the University of Arizona (HiRISE) and NASA EONET. Use of NASA data does not imply NASA endorsement.</sub>
