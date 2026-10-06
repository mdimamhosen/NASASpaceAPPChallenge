# Mars Explorer: NASA Space Apps 2026 project page

**Team:** Binary Explorers (Md Imam Hosen, Md Ahad, Biswadev Biswas)
**Challenge:** 11, Interplanetary Survival Guide: Martian Map (2026 NASA Space Apps Challenge, theme "The Next Frontier")
**Also relevant:** 1, Abandoned but not Forgotten (the "Left on Mars" hardware layer)
**Repository:** https://github.com/mdimamhosen/NASASpaceAPPChallenge (public, Apache-2.0)
**240-second video:** _add the YouTube/Vimeo link_

---

## High-Level Summary

Mars Explorer is a Martian survival map for planning a walk on Mars from evidence, not guesswork. On a live NASA Mars Trek map of Jezero Crater, users follow Perseverance sol by sol, draw a Marswalk, and get the terrain along it sampled from NASA's orbital elevation model. They see a non-certifying Traverse Risk Index in which every component cites its source, plus the IAU-named features and HiRISE terrain models along the route. A slope-aware A* corridor and a 3D fly-through over HiRISE imagery come next. A cited AI assistant and a tool-using mission agent explain the results, but never compute them; every number in an agent answer is checked against tool output. The map also shows every NASA lander and rover left on Mars and when each went silent, and links each mission to its datasets on data.nasa.gov. It runs fully offline with `OFFLINE=1`, answers in Bangla when a cloud model is available, and exports a mission briefing as Markdown or PDF. It helps students, teachers, mission enthusiasts and, one day, crews who will need to plan without real-time help from Earth.

## Project Demo

The 30-second global video covers: the team, the problem (scattered data and unverifiable answers), the map working (route, risk, corridor, 3D), the NASA datasets named on screen, and the impact.

## Project Details

### Why
NASA publishes the data needed to plan a Mars traverse: rover localizations, a 1 m orbital DEM, HiRISE terrain models, official feature names and 1,321 Mars datasets on data.nasa.gov. But it is scattered across archives and formats, and general-purpose chatbots answer Mars questions with invented coordinates nobody can check. Signals take up to 22 minutes to travel one way between Earth and Mars, so future crews will need to plan on their own, with evidence they can trust.

### What
- **Martian map:** NASA Mars Trek layers (MOLA, Viking, MOLA/HRSC), the PLACES rover track with a sol scrubber, IAU feature names, HiRISE DTM footprints, NASA landing sites with their data.nasa.gov datasets, and the "Left on Mars" hardware layer with a last-contact timeline.
- **Route analysis:** DEM-sampled elevation and slope profile, Traverse Risk Index (non-certifying, every component sourced), comparison with Perseverance's real track, named features and DTM coverage on the route, A* corridor, and a 3D fly-through on HiRISE/CTX imagery.
- **Evidence AI:** a hybrid RAG assistant (BM25 + embeddings, RRF + MMR, evidence gate, citation validation) and a mission agent with 10 validated tools. A provenance drawer shows the raw tool JSON behind each number, and Bangla answers are available.
- **Earth lane:** NASA EONET events on NASA GIBS VIIRS NOAA-20 imagery, kept strictly separate from Mars.
- **Briefings:** Markdown and server PDF, plus a shareable mission card.
- **Offline-first:** every external source falls back from live to cache to a committed fixture, and the interface shows a LIVE/CACHE/FIXTURE badge.

### How
TypeScript monorepo: Next.js + three.js on the web, NestJS on the API (one module per domain), with contracts shared in `packages/shared`. All science is deterministic code with runnable checks; models only retrieve, orchestrate and explain (see `docs/AI_USE.md`).

### Highlighted features
Sol-by-sol rover track · Risk Index with sources · A* corridor · 3D fly-through · IAU names and HiRISE DTM coverage on routes · Left-on-Mars timeline · cited RAG · mission agent with provenance gate · data.nasa.gov catalog search · Bangla answers · offline mode · eleven 3D data stories.

### Tools and technologies
Next.js, React, three.js / React Three Fiber, Leaflet, NestJS, TypeScript, pnpm, Python (data refresh scripts), PDFKit, Gemini and Claude APIs (optional), TypeSafe Jev (optional), ffmpeg (video), Claude Code (development).

## Use of AI
See [`docs/AI_USE.md`](AI_USE.md): every tool named, what it did and did not do, and where each prompt lives.

## NASA data sources used

| Dataset | Used for | How |
|---|---|---|
| Mars 2020 PLACES rover localizations (PDS) | Rover track, sol scrubber, verified locations | CSV snapshot with sha256; refreshed by `pnpm refresh:nasa` |
| Mars 2020 PLACES orbital DEM (PDS) | Elevation, slope, Risk Index, A* corridor, 3D terrain | Sampled to a ~118 m grid; non-certifying |
| NASA Mars Trek WMTS (MOLA, Viking, MOLA/HRSC, HiRISE, CTX) | Basemaps and 3D textures | Live tiles |
| data.nasa.gov Mars catalog (1,321 records) | Open Data page, mission data shelves, agent tool | CKAN snapshot plus live search with fallback |
| data.nasa.gov: MRO HiRISE DTM V1.0 | 1,315 DTM footprints; route coverage | PDS DTM cumulative index |
| data.nasa.gov: Gazetteer of Planetary Nomenclature, Mars | 2,052 IAU names; named features on routes | IAU/USGS shapefile, parsed |
| NSSDCA | Landing coordinates, hardware records, planetary constants | Cited per record |
| JPL SSD approximate planet positions | Earth–Mars distance, light delay | Keplerian elements in code |
| NASA EONET v3 | Earth natural events (Earth only) | Live, with durable cache |
| NASA GIBS (VIIRS NOAA-20 corrected reflectance) | Earth basemap | WMTS tiles |
| NASA mission pages (science.nasa.gov) | RAG corpus | 23 documents with retrieval dates |

**Partner and third-party data:** the IAU Working Group for Planetary System Nomenclature and the USGS Astrogeology gazetteer (feature names), and the University of Arizona HiRISE team (DTM index and products).

## References
All dataset URLs are in `README.md` → NASA data sources and in `/science` in the app. Libraries are credited in `package.json` files. Imagery credits: NASA/JPL-Caltech, NASA/JPL/University of Arizona (HiRISE), NASA GIBS, USGS Astrogeology.

## Score-sheet coverage

| Criterion | Where it shows |
|---|---|
| Impact | Training a planning habit for crews who must plan without Earth; classrooms get a real mission |
| Creativity | Planning a Marswalk against Perseverance's real path; the Left-on-Mars timeline |
| Validity | Deterministic `compute` code with runnable checks; provenance drawer; non-certifying labels |
| Relevance | Eleven NASA products are central, not decorative, and named on screen |
| Presentation | 240-second video, WHO → WHY → WHAT → HOW |
| Teamwork | Roles above; commit history |
| User experience | Guided tour, onboarding coach, command palette, presets, Classroom Mode, Bangla answers |
| NASA data usage | NASA data plus IAU/USGS and University of Arizona partner sources |
| Category named · repository public · page complete | Challenge 11 above; public Apache-2.0 repository; this page |
