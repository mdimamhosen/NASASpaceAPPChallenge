# Mars Explorer — four-minute narrated walkthrough

Voice: macOS Samantha at 0.93× tempo · total 4:03 · generated from `script.json`.

| Time | Page | On screen | Narration |
|---|---|---|---|
| 0:00–0:15 | `/` | hold | This is Mars Explorer, a source-grounded research console for planning a Marswalk in Jezero Crater, where NASA's Perseverance rover landed. Every number on screen comes from a published NASA product, and every route is labeled non-certifying. |
| 0:15–0:29 | `(same page)` | scroll to 3D/section | Below the hero is real ground. NASA HiRISE and CTX orbital images from Mars Trek are draped over the Mars 2020 PLACES elevation model, and the white line is Perseverance's published path. |
| 0:29–0:41 | `(same page)` | scroll to 3D/section | Earth gets its own lane. This live NASA EONET feed lists wildfires, storms, and sea ice events with their sources. Earth coordinates never touch the Mars map. |
| 0:41–0:55 | `/survival` | scroll to 3D/section | The challenge starts with scale. Here are Earth and Mars at true relative size, tilt, and spin, from the NASA Planetary Fact Sheet. Mars is about half as wide, with thirty-eight percent of Earth's gravity. |
| 0:55–1:07 | `/jezero` | scroll to 3D/section | This is Jezero, cell by cell. Each of these four thousand five hundred columns is one sample of the PLACES orbital elevation model, rising from the dark crater floor to the delta and the rim. |
| 1:07–1:21 | `/eonet` | scroll to 3D/section | The EONET page goes deeper. Filter live Earth events, open a record's timeline and sources, and check provenance: the upstream fetch time, the content hash, and whether the feed came from cache. |
| 1:21–1:33 | `/explore` | scrub sol slider | Now the mission console. NASA Trek layers sit on the left. The PLACES rover track crosses Jezero, and the sol scrubber walks Perseverance through its published positions. |
| 1:33–1:45 | `(same page)` | click “LOAD PUBLISHED ROUTE” | Load a published route, or draw your own. The API samples the elevation model along it and returns a Traverse Risk Index, with every component and its source listed in the evidence cockpit. |
| 1:45–1:58 | `(same page)` | hold | Under the map, the elevation and slope profile shows the measured terrain along the route. The cockpit compares the route with where Perseverance actually drove, and names the closest published sol. |
| 1:58–2:09 | `(same page)` | click “3D / DEM”, click “FLY ROUTE” | Switch to 3D, and the same route is draped on HiRISE imagery over the elevation model. Fly route follows it across the delta, with exaggeration you can tune. |
| 2:09–2:20 | `(same page)` | click “STOP”, click “WHY IS THIS ROUTE SCIENTIFICALLY INTERESTING” | The mission assistant answers from a local corpus of cited NASA sources. Cloud models are optional and off by default, and every answer carries its citations. |
| 2:20–2:29 | `/traces` | scroll | Traces records each assistant run, retrieve, grade, and assemble, so anyone can inspect exactly what the system did. |
| 2:29–2:39 | `/briefing/preview` | scroll to 3D/section | The briefing turns a route into a mission note and a server-rendered PDF. Below, that route is raised into an elevation curtain, colored by sampled slope. |
| 2:39–2:50 | `/targets` | scroll to 3D/section | Targets shows Perseverance's climb. Each pillar rises to a published PLACES elevation, about eight hundred meters of ascent, with NASA-verified locations in orange. |
| 2:50–3:02 | `/hazards` | scroll to 3D/section | Hazards maps measured slope. Orange cells reach fifteen degrees, where the risk index slope term saturates. The grid cannot see rocks, and the page says so. |
| 3:02–3:09 | `/mission` | scroll to 3D/section | The mission space-time cube stacks the traverse by sol. Ground position is where the rover was, and height is when. |
| 3:09–3:19 | `/timeline` | scroll to 3D/section, click “PLAY” | The timeline computes where Earth and Mars are on any day from NASA JPL orbital elements, with the distance and the one-way light delay a command must cross. |
| 3:19–3:28 | `/data` | scroll to 3D/section | The data page tours all nine NASA Mars landings, from Viking in nineteen seventy-six to Perseverance in twenty twenty-one. |
| 3:28–3:38 | `/science` | scroll to 3D/section | Science explodes the three source layers, elevation, imagery, and rover positions, and its register lists every product, date, and limit. |
| 3:38–3:48 | `/architecture` | scroll | Architecture shows the real system. NASA sources flow through NestJS modules into the web console, with Earth data on its own blue lane. |
| 3:48–3:54 | `/route/share?wp=%5B%7B%22lat%22%3A18.4446%2C%22lon%22%3A77.4509%7D%2C%7B%22lat%22%3A18.4526%2C%22lon%22%3A77.4078%7D%2C%7B%22lat%22%3A18.4997%2C%22lon%22%3A77.3513%7D%5D` | scroll to 3D/section | Any route can be shared as a link and a mission card, shown here in 3D, front and back. |
| 3:54–4:03 | `/` | hold | Mars Explorer. Real NASA data, cited answers, and honest limits, from a surface question to an accountable briefing. |
