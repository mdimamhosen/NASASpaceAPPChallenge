# NASA Open Data (data.nasa.gov Mars tag) integration — complete

## Phase and task

Use datasets from https://data.nasa.gov/dataset/?tags=mars across the app, including the main Mars map, and harden the API. Done locally; not committed.

## Completed files

- `scripts/refresh-open-data.py` (`pnpm refresh:opendata`) → `data/opendata/{catalog,hirise-dtm,iau-features,SOURCE}.json`, `data/corpus/nasa-open-data-mars.md`
- API: `apps/api/src/opendata/*` (logic, service, controller, module, check); route analysis + briefing open-data context; agent tools `nasa_open_data`, `named_features` + intents/Jev questions; `/health/ready`; `@nestjs/throttler` global guard (+ stricter AI/corpus limits); `trust proxy`
- Shared: open-data types, `NASA_MARS_LANDINGS`, `DATA_NASA_MARS_URL`, LayerId `names` / `landings`, AgentLabel `OPEN DATA`
- Web: `MarsMap` overlays (IAU names, HiRISE DTM footprints, landing sites), Explore cockpit + detail modals + palette commands, `/opendata` page, nav link, science register rows, styles; `data/layers.json`
- README, `.env.example`

## Acceptance (verified)

Shared, API, and isolated web (`MARS_NEXT_DIST_DIR=.next-feature`) builds pass. Checks pass: opendata, intents, rag, geo, orbits. API smoke covered catalog (snapshot + live), features, DTM, landings, route `openData`, briefing sections, agent tools, rate-limit headers, `/health/ready`. Browser screenshots verified `/opendata` (desktop + 390 px) and `/explore` (Jezero route context, global landings).

## Remaining work

None.
