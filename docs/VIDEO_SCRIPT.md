# Mars Explorer — four-minute recording script

The narrated, subtitled recording lives in [`docs/video/`](video/): `mars-explorer-4min.mp4` (burned-in subtitles), `mars-explorer-4min.srt`, `narration.m4a`, and the timed script in [`NARRATION_4MIN.md`](video/NARRATION_4MIN.md). All are generated from [`script.json`](video/script.json). The table below is the shorter manual shot list.

Record at 1440 × 900 with the API awake. Keep cloud models off. The **PLAY STORY** control follows the eleven stops automatically; pause it while demonstrating an interaction. The map, risk score, and cards are research aids, not operational navigation.

| Time | Screen and action | Spoken track |
|---|---|---|
| 0:00–0:25 | `/` — Mars globe, the Jezero 3D terrain showcase, then Earth feed. | “Mars Explorer joins published Mars data with a cited mission briefing. This terrain is real: NASA HiRISE and CTX imagery on the PLACES elevation model, with Perseverance’s published path. The Earth event feed is a separate NASA EONET source.” |
| 0:25–0:50 | `/survival`, `/jezero` — inspect the 3D studies. | “The scenes introduce the field question. They illustrate terrain and story; the measured route data appear in Explore.” |
| 0:50–1:15 | `/eonet` — filter a live Earth event. | “EONET publishes Earth events. The page shows the source fetch time, cache status, and a category museum. None of these Earth coordinates enter the Mars map.” |
| 1:15–2:15 | `/explore` — scrub the NASA PLACES track, focus a sol, load the published route, inspect DTM Risk Index and the elevation/slope profile, ask for a corridor, then switch to **3D / DEM** and press **FLY ROUTE**. | “PLACES provides published interpolated Perseverance localization by sol. The orbital DEM supplies coarse elevation and slope samples. The A* corridor and risk weights are application heuristics, always non-certifying.” |
| 2:15–2:40 | Ask a mission question, open a citation, then `/traces`. | “The default assistant retrieves cited local mission notes. Recent pipeline traces persist to Postgres or a local file.” |
| 2:40–3:15 | `/briefing/preview` and its PDF. | “The server PDF includes each Traverse Risk Index component and its source.” |
| 3:15–3:40 | `/targets`, `/hazards` — switch on DEMO seeds. | “These optional annotations are local illustrations, off by default and labeled as demo data. They do not drive the DTM score.” |
| 3:40–4:00 | `/architecture`, `/story`, `/science` — close on the source register. | “The source register lists the exact PDS CSV, DEM label, Trek layers, EONET feed, dates, and limits. Every route conclusion stays inspectable.” |

The `/ops` page remains available and visibly **SIMULATED**. It is outside the real-data story beat.
