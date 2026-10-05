# Mars Explorer — four-minute narrated walkthrough · Team Binary Explorers

Voice: macOS Samantha at 0.93× tempo · total 3:57 · generated from `script.json`.

| Time | Page | On screen | Narration |
|---|---|---|---|
| 0:00–0:18 | `/` | hold | This is Mars Explorer, built by team Binary Explorers: a source-grounded research console for planning a Marswalk in Jezero Crater, where NASA's Perseverance rover landed. Every number on screen comes from a published NASA product, and every route is labeled non-certifying. |
| 0:18–0:44 | `(same page)` | hold | Our team. Md Imam Hosen, team lead, system architect and full-stack engineer, leads the architecture from the NestJS API to the mission console. Md Ahad, researcher and NASA data analyst, sources and verifies the NASA data behind every claim. Biswadev Biswas, AI engineer and 3D UI developer, builds the agents, retrieval, and 3D scenes. |
| 0:44–0:56 | `(same page)` | scroll to 3D/section | Below the hero is real ground: NASA HiRISE and CTX orbital images draped over the Mars 2020 PLACES elevation model, with Perseverance's published path in white. |
| 0:56–1:12 | `(same page)` | scroll to 3D/section, click “RUN AGENT” | The home page now hosts the mission agent. A System One router picks every tool in a single pass, using TypeSafe AI's Jev decision model when it is configured. The tools run in parallel, and Gemini streams the answer, with Claude as the fallback. |
| 1:12–1:26 | `(same page)` | click “ASK THE CORPUS”, click “ASK” | Ask the corpus is retrieval-augmented generation over twenty-two NASA documents. Keyword and semantic search are fused, off-topic questions are refused, and every sentence cites the passage it came from. |
| 1:26–1:43 | `(same page)` | scroll to 3D/section | The passage panel previews retrieval live as you type, with keyword, semantic, and fused scores. The 3D embedding space shows the question beside its nearest passages, and hybrid search reaches a mean reciprocal rank of zero point nine six. |
| 1:43–1:54 | `/survival` | scroll to 3D/section | Earth and Mars at true relative size, tilt, and spin, from the NASA Planetary Fact Sheet: about half as wide, with thirty-eight percent of Earth's gravity. |
| 1:54–2:04 | `/jezero` | scroll to 3D/section | Jezero, cell by cell: four thousand five hundred columns of the PLACES orbital elevation model, rising from the crater floor to the delta. |
| 2:04–2:15 | `/eonet` | scroll to 3D/section | Earth gets its own lane. The live NASA EONET feed shows wildfires and storms with source provenance and cache status, and Earth coordinates never touch the Mars map. |
| 2:15–2:24 | `/explore` | scrub sol slider | In the mission console, NASA Trek layers sit on the left, and the sol scrubber walks Perseverance through its published positions. |
| 2:24–2:35 | `(same page)` | click “LOAD PUBLISHED ROUTE” | Load a published route or draw your own. The API samples the elevation model and returns a Traverse Risk Index, with every component and source in the evidence cockpit. |
| 2:35–2:44 | `(same page)` | hold | The elevation and slope profile shows the measured terrain, and the cockpit compares the route with where Perseverance actually drove. |
| 2:44–2:51 | `(same page)` | click “3D / DEM”, click “FLY ROUTE” | Switch to 3D, and the route is draped on HiRISE imagery. Fly route follows it across the delta. |
| 2:51–2:57 | `/traces` | scroll | Traces records each assistant run, so anyone can inspect what the system did. |
| 2:57–3:04 | `/briefing/preview` | scroll to 3D/section | The briefing becomes a server-rendered PDF, and its route rises into an elevation curtain colored by slope. |
| 3:04–3:12 | `/targets` | scroll to 3D/section | Targets shows Perseverance's climb, about eight hundred meters, with NASA-verified locations in orange. |
| 3:12–3:20 | `/hazards` | scroll to 3D/section | Hazards maps measured slope. Orange cells reach fifteen degrees, and the page says the grid cannot see rocks. |
| 3:20–3:29 | `/timeline` | scroll to 3D/section, click “PLAY” | The timeline computes where Earth and Mars are on any day from NASA JPL orbital elements, with the one-way light delay a command must cross. |
| 3:29–3:35 | `/data` | scroll to 3D/section | The data page tours all nine NASA Mars landings, from Viking to Perseverance. |
| 3:35–3:47 | `/architecture` | scroll | Architecture shows the real system: NASA sources flow through NestJS modules, the retrieval index, and the agent tools into the web console, with Earth data on its own lane. |
| 3:47–3:57 | `/` | hold | Any route can be shared as a link and a mission card. Mars Explorer, by Binary Explorers: real NASA data, cited answers, and honest limits. |
