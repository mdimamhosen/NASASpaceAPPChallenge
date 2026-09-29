import type { SceneKind } from '@/components/scenes/SceneStage';

export const sources = {
  perseverance: { title: 'NASA Perseverance mission', url: 'https://science.nasa.gov/mission/mars-2020-perseverance/' },
  objectives: { title: 'NASA Perseverance science objectives', url: 'https://science.nasa.gov/mission/mars-2020-perseverance/science-objectives/' },
  trek: { title: 'NASA Mars Trek', url: 'https://trek.nasa.gov/mars/' },
  trekApi: { title: 'NASA Mars Trek tile service', url: 'https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars' },
  eonet: { title: 'NASA EONET v3', url: 'https://eonet.gsfc.nasa.gov/docs/v3' },
  hirise: { title: 'NASA Jezero orbital reference', url: 'https://science.nasa.gov/photojournal/jezero-craters-kodiak-and-scarps/' },
  launch: { title: 'NASA Perseverance launch', url: 'https://science.nasa.gov/blogs/perseverance-mars-rover/2020/07/30/successful-launch-sends-perseverance-on-seven-month-journey-to-mars/' },
  landing: { title: 'NASA Perseverance landing', url: 'https://science.nasa.gov/blogs/perseverance-mars-rover/2021/02/18/blog-nasas-perseverance-has-landed/' },
  highlights: { title: 'NASA Perseverance science highlights', url: 'https://science.nasa.gov/mission/mars-2020-perseverance/science-highlights/' },
  texture: { title: 'NASA/JPL Mars image texture', url: 'https://science.nasa.gov/3d-resources/mars/' },
  usgs: { title: 'USGS Mars 2020 terrain products', url: 'https://astrogeology.usgs.gov/search/map/mars_2020_terrain_relative_navigation_hirise_dtm_mosaic' },
} as const;
export type SourceId = keyof typeof sources;
export type DossierSection = { id: string; kicker: string; title: string; lead: string; points: string[]; sourceIds?: SourceId[] };
export type Dossier = { eyebrow: string; title: string; deck: string; scene: SceneKind; stats: [string, string][]; quote: string; sections: DossierSection[]; next: string; nextLabel: string };
const s = (id: string, kicker: string, title: string, lead: string, points: string[], sourceIds?: SourceId[]): DossierSection => ({ id, kicker, title, lead, points, sourceIds });

export const dossiers: Record<string, Dossier> = {
  survival: {
    eyebrow: 'THE CHALLENGE / MARS SURFACE', title: 'Every field decision needs evidence.', scene: 'solar',
    deck: 'A future Marswalk concept needs scientific purpose, terrain context, and clear uncertainty. This demonstration keeps those three layers visible throughout the route.',
    stats: [['QUESTION', 'WHERE TO LOOK?'], ['METHOD', 'SOURCE FIRST'], ['STATUS', 'CONCEPT ONLY']],
    quote: 'A useful field plan tells you what to inspect next and what it cannot yet know.',
    sections: [
      s('challenge', '01 / THE BRIEF', 'Build a route around a question', 'Jezero offers a compelling setting for discussing past water and habitability. A route becomes useful when it names the evidence sought at each stop.', ['Choose a science objective before drawing.', 'Treat a map marker as a prompt for investigation, not a validated stop.', 'Carry links to the source record into the final briefing.'], ['objectives']),
      s('terrain', '02 / TERRAIN', 'Read the map at its own resolution', 'Orbital imagery offers broad context. It cannot, by itself, certify a walking surface or reveal every local obstacle.', ['Compare the Viking and MOLA context layers.', 'Inspect the seeded watch zones as illustrations only.', 'Use the heuristic score to prioritize questions for expert review.'], ['trekApi']),
      s('resources', '03 / LIFE SUPPORT', 'Keep operational needs separate', 'Water, power, communications, and thermal constraints would matter to a real expedition. This demo does not model them.', ['No consumables budget is calculated.', 'No line of sight or communications link is certified.', 'No EVA duration is approved by the route estimate.']),
      s('evidence', '04 / EVIDENCE', 'Ask only what the corpus can support', 'The assistant retrieves local mission notes and returns citations. When the notes do not support a claim, it should say so.', ['Default path makes no cloud model call.', 'Earth EONET is consulted only for an Earth question.', 'Open each linked NASA source for complete context.'], ['perseverance', 'eonet']),
      s('boundaries', '05 / BOUNDARIES', 'The route is a research sketch', 'The coordinates are approximate and the watch zones are seeded. They are not a flight route or a rover position.', ['Score is non-certifying.', 'Terrain data are not a measured slope profile.', 'Keep the limitations in the exported briefing.']),
      s('handoff', '06 / HANDOFF', 'Turn uncertainty into the next action', 'The outcome is an inspectable mission note: route length, nearby context, uncertainties, and source links.', ['Load the demo Marswalk in Explore.', 'Ask one cited question.', 'Download the server PDF and read its caveat.']),
    ], next: '/jezero', nextLabel: 'ENTER JEZERO',
  },
  mission: {
    eyebrow: 'MISSION CONCEPT / JEZERO', title: 'Read the record. Choose the traverse.', scene: 'mars',
    deck: 'A science led Marswalk concept connects orbital context, Jezero geology, and Perseverance objectives without presenting a desktop route as flight ready.',
    stats: [['SITE', 'JEZERO'], ['MISSION', 'MARS 2020'], ['MODE', 'RESEARCH AID']],
    quote: 'The field investigator asks what the map suggests, then returns to the source before making a claim.',
    sections: [
      s('setting', '01 / SETTING', 'An ancient environmental record', 'NASA selected Jezero because its ancient lake and delta setting offers a rich record for investigating past environments.', ['The crater links water history to rock context.', 'A delta helps frame questions about sediment transport.', 'The app uses this setting as a narrative and planning case.'], ['perseverance', 'objectives']),
      s('investigator', '02 / PERSONA', 'The field investigator', 'The intended user is a scientist or communicator exploring why a hypothetical route might be interesting, not a rover driver.', ['Browse regional imagery.', 'Open source linked targets.', 'Document why each waypoint was included.']),
      s('objectives', '03 / SCIENCE', 'Let objectives steer the route', 'NASA describes geology, astrobiology, sample caching, and preparation for humans among Perseverance objectives.', ['A route can connect places to geology questions.', 'A nearby point does not establish a finding.', 'Sample decisions remain outside this demo.'], ['objectives']),
      s('map', '04 / MAP', 'Use Trek as planetary context', 'Mars Trek provides an accessible orbital basemap; the app layers its own approximate Jezero notes on top.', ['Switch imagery layers in Explore.', 'Check map attribution and scale.', 'Treat schematic overlays as separate from NASA raster data.'], ['trek', 'trekApi']),
      s('answer', '05 / EVIDENCE', 'Explain the traverse with citations', 'A local corpus retrieves mission notes to answer a focused question. Source links remain visible beside the response.', ['The default answer is a template, not generated mission advice.', 'Cloud model use requires explicit opt in.', 'Earth event context remains labeled EARTH / EONET.']),
      s('deliverable', '06 / OUTPUT', 'Issue an accountable note', 'The briefing assembles metrics, objectives, nearby points, caveats, and citations from deterministic data.', ['Download Markdown or server PDF.', 'Review the source register.', 'State that scoring is non-certifying.']),
    ], next: '/timeline', nextLabel: 'MISSION TIMELINE',
  },
  timeline: {
    eyebrow: 'MISSION CHRONOLOGY / CURATED', title: 'From ancient lake to fieldwork.', scene: 'mars',
    deck: 'A compact sequence links Jezero’s environmental history with the Mars 2020 mission and the present demonstration.',
    stats: [['ANCIENT', 'LAKE + DELTA'], ['2020', 'LAUNCH'], ['2021', 'LANDING']],
    quote: 'The chronology is a reading guide, not an estimate of the age of a particular seeded map point.',
    sections: [
      s('ancient', '01 / GEOLOGIC TIME', 'A lake and delta setting', 'NASA describes Jezero as an ancient lake basin with a river delta. The layered record motivates questions about past habitability.', ['No exact age is assigned to a demo waypoint.', 'Sediment context is a scientific motivation, not a life detection.', 'Look for complete geologic interpretation in linked mission science.'], ['objectives']),
      s('selection', '02 / SITE CHOICE', 'Why Jezero entered the mission', 'A diverse geologic setting and evidence of past water made Jezero a site for the Mars 2020 investigation.', ['Landing site selection is a NASA mission decision.', 'The app does not reproduce landing site certification.', 'Its route is hypothetical.'], ['perseverance']),
      s('launch', '03 / JULY 2020', 'Perseverance leaves Earth', 'NASA launched Perseverance on July 30, 2020, beginning its journey to Mars.', ['This is a mission milestone from NASA.', 'The transfer animation is an illustration.', 'It is not a flight trajectory visualization.'], ['launch']),
      s('landing', '04 / FEBRUARY 2021', 'Perseverance reaches Jezero', 'NASA confirmed the rover’s landing in Jezero on February 18, 2021.', ['The rover’s actual path is separate from this demo route.', 'No live rover positions are streamed here.', 'The operations page uses simulated ticks.'], ['landing']),
      s('surface', '05 / SURFACE SCIENCE', 'Rocks become a record', 'Perseverance studies geology, ancient environments, and sample context in the crater.', ['Open NASA’s science highlights for mission observations.', 'Do not treat curated annotations as exact sample locations.', 'The briefing cites its mission notes.'], ['highlights', 'objectives']),
      s('today', '06 / THIS DEMO', 'A planning conversation', 'Mars Explorer turns the broader mission setting into an interactive, evidence grounded route sketch.', ['Switch Trek layers.', 'Draw and analyze a Marswalk.', 'Compare every claim to its source.']),
    ], next: '/data', nextLabel: 'DATA REGISTER',
  },
  jezero: {
    eyebrow: 'FIELD SITE / JEZERO CRATER', title: 'An ancient delta. A modern question.', scene: 'mars',
    deck: 'Jezero is the science setting for this concept. Orbital context, approximate seed points, and source links build a region dossier.',
    stats: [['REGION', 'JEZERO CRATER'], ['CONTEXT', 'LAKE + DELTA'], ['POINTS', 'SEEDED']],
    quote: 'The map asks where evidence may be worth inspecting; it does not claim that a waypoint is safe.',
    sections: [
      s('lake', '01 / BASIN', 'A lake shaped the question', 'NASA describes Jezero as a crater that once held a lake, making it a place to study ancient environmental conditions.', ['The local route does not reconstruct shoreline history.', 'Use NASA mission context for the geologic interpretation.', 'Keep map annotations separate from measured mission data.'], ['perseverance', 'objectives']),
      s('delta', '02 / WESTERN DELTA', 'Sediment carries context', 'A river delta preserves layers that can inform questions about deposition and past water.', ['The seeded delta point is approximate.', 'It directs attention to a source, not a sample target.', 'Open the orbital reference before interpreting a feature.'], ['objectives', 'hirise']),
      s('scarps', '03 / ORBITAL READING', 'Relief and scarps', 'NASA image references show features around Perseverance’s exploration area, including Kodiak and scarps.', ['The app’s HiRISE boxes are schematic.', 'A color shaded basemap is not an elevation profile.', 'Zoom and source imagery may change the visual story.'], ['hirise', 'trekApi']),
      s('floor', '04 / CRATER FLOOR', 'More than one rock story', 'NASA’s science highlights discuss different rock contexts across the mission.', ['A nearby seed marker is a question prompt.', 'It is not a verified rover stop.', 'Only the linked source can support a specific rock claim.'], ['highlights']),
      s('coordinates', '05 / GEOMETRY', 'Approximate coordinates', 'The region map centers near 18.44° N, 77.45° E. Seed points are intentionally approximate for demonstration.', ['Longitude and latitude are Mars coordinates.', 'The route length uses a Mars radius.', 'Neither the center nor the route represents a navigation solution.'], ['trek']),
      s('route', '06 / TRAVERSE', 'Carry the site into Explore', 'The demo Marswalk crosses a small part of the regional map to exercise route metrics and source retrieval.', ['Load the preset route.', 'Inspect points within 2 km.', 'Read the non-certifying score explanation.']),
    ], next: '/eonet', nextLabel: 'EARTH CONTEXT',
  },
  data: {
    eyebrow: 'DATA CATALOG / NASA + USGS', title: 'Every layer has a provenance.', scene: 'mars',
    deck: 'An explicit inventory separates NASA raster layers, curated region annotations, the local source corpus, and Earth event metadata.',
    stats: [['MARS', 'TREK TILES'], ['JEZERO', 'SEED GEOJSON'], ['EARTH', 'EONET V3']],
    quote: 'A measured image, an approximate annotation, and a heuristic score deserve different labels.',
    sections: [
      s('mola', '01 / ORBITAL BASE', 'MOLA shaded context', 'The Mars Trek MOLA shaded relief layer supports regional visual orientation. Display shading is not a sampled route elevation.', ['Resolution changes with zoom.', 'Tile availability depends on the service.', 'Do not infer an EVA slope from screen color.'], ['trekApi']),
      s('viking', '02 / GLOBAL MOSAIC', 'Viking color context', 'The alternate Trek mosaic offers broad color context at planetary and regional scales.', ['It is a raster basemap.', 'It is not a present day hazard product.', 'The globe texture is also a NASA/JPL Viking derived image.'], ['trekApi', 'texture']),
      s('points', '03 / JEZERO POINTS', 'Source linked, approximate', 'Local GeoJSON supplies the science point register shown in Explore and Targets.', ['Coordinates are demonstration annotations.', 'Each point links to a NASA reference.', 'Proximity is not proof of scientific value.']),
      s('zones', '04 / WATCH ZONES', 'A non-certifying overlay', 'Seed polygons exercise route intersection logic and make uncertainty visible.', ['They are not certified hazards.', 'The default route method samples geometry heuristically.', 'Optional PostGIS uses the same seed geometry.']),
      s('corpus', '05 / SOURCE NOTES', 'Local retrieval material', 'Three short mission notes in data/corpus feed the default assistant and briefing source register.', ['Retrieval may return no match.', 'A citation links to a broader source.', 'The notes are not a comprehensive literature review.']),
      s('earth', '06 / PLANETARY BOUNDARY', 'EONET is Earth only', 'NASA EONET v3 events appear on an Earth map and in the optional Earth assistant tool.', ['EONET geometry never overlays Mars Trek.', 'The event feed can change over time.', 'Earth analogy is a question, not a terrain transfer.'], ['eonet']),
    ], next: '/analog', nextLabel: 'EARTH ANALOG',
  },
  analog: {
    eyebrow: 'COMPARATIVE CONTEXT / EARTH ONLY', title: 'Analogy is a question, not a transfer.', scene: 'solar',
    deck: 'Earth events may sharpen observation questions about water, sediment, and landscape change. They do not describe Martian surface hazards.',
    stats: [['FEED', 'NASA EONET'], ['GEOMETRY', 'EARTH ONLY'], ['USE', 'COMPARISON']],
    quote: 'Ask what process is comparable before claiming two places tell the same story.',
    sections: [
      s('boundary', '01 / PLANETS', 'Keep maps separate', 'EONET is NASA’s Earth natural event catalog. Event locations stay in the Earth context panel.', ['No EONET marker appears on Mars.', 'A wildfire event is not a Mars hazard.', 'The assistant labels Earth tool output EARTH / EONET.'], ['eonet']),
      s('process', '02 / PROCESS', 'Compare questions carefully', 'Earth river deltas can help frame questions about sediment transport, but Mars has a different environment and history.', ['Compare a process, not a location.', 'State the limits of analogy.', 'Return to Mars specific evidence for claims about Jezero.'], ['objectives']),
      s('feed', '03 / LIVE FEED', 'Events change over time', 'The EONET panel fetches open Earth events. Counts and coordinates may differ between visits.', ['Open each event source for details.', 'The feed is cached briefly by the API.', 'A missing point remains a list item without a map pin.'], ['eonet']),
      s('map', '04 / GOOGLE EARTH MAP', 'A separate cartographic surface', 'The Earth theater uses Google Maps to display EONET point events when a browser key is configured.', ['The key is for the browser Maps JavaScript API.', 'The page includes a source register without the key.', 'Mars Trek remains the default Mars map.']),
      s('assistant', '05 / EVIDENCE TOOL', 'Invoke only for Earth questions', 'A question about Earth, EONET, or natural events triggers a separate Earth lookup in the local pipeline.', ['The trace records when the lookup ran.', 'The answer marks the Earth data clearly.', 'No model call is needed by default.']),
      s('return', '06 / RETURN TO MARS', 'Bring back better questions', 'After viewing Earth events, return to the Mars console to inspect Jezero imagery and its own sources.', ['Keep planetary coordinates separate.', 'Use NASA Mars sources for Jezero facts.', 'Export a briefing with explicit limitations.'], ['trek', 'perseverance']),
    ], next: '/explore', nextLabel: 'OPEN MARS CONSOLE',
  },
  architecture: {
    eyebrow: 'SYSTEM ARCHITECTURE / EVIDENCE FIRST', title: 'A traceable field system.', scene: 'architecture',
    deck: 'NASA sources, modular services, and a deterministic evidence pipeline make each planning claim inspectable. Cloud models stay optional.',
    stats: [['FRONTEND', 'NEXT.JS'], ['BACKEND', 'NESTJS'], ['CONTRACTS', 'SHARED TS']],
    quote: 'The architecture preserves the boundary between a source, an inference, and a demonstration.',
    sections: [
      s('web', '01 / WEB', 'A mission console in Next.js', 'The web app presents theater pages, the Mars Trek surface console, the Earth EONET theater, and exports.', ['Leaflet renders Mars Trek by default.', 'Google Maps renders the separate Earth surface.', 'A Google Maps shell for Trek is optional.']),
      s('api', '02 / API', 'Feature modules own their logic', 'Nest modules separate regions, routes, EONET, retrieval, assistant responses, briefings, and simulated operations.', ['Secrets stay with the API.', 'The browser receives only a public Maps key.', 'Shared DTOs define the crossing between apps.']),
      s('data', '03 / DATA', 'Small, explicit seed set', 'GeoJSON and corpus files in data/ are the local demonstration record.', ['Approximate POIs and polygons are plainly labeled.', 'PostGIS can accelerate the Jezero geometry profile.', 'There is no full planet PDS pipeline.']),
      s('pipeline', '04 / EVIDENCE', 'Retrieve, grade, assemble', 'The default assistant retrieves local notes, optionally consults Earth EONET, grades evidence, then assembles a template answer.', ['No cloud model is called by default.', 'The trace page shows each step.', 'The last trace is process memory, not durable observability.']),
      s('deliver', '05 / DELIVER', 'Generate a deterministic document', 'Route metrics, local objectives, caveats, and citations form a briefing. PDFKit renders a server PDF.', ['No model writes the briefing.', 'The PDF carries the non-certifying caveat.', 'The source register links back to NASA.']),
      s('limits', '06 / LIMITS', 'Keep demonstration honest', 'The ops stream is simulated and the score is educational. Neither is a rover downlink or approved traverse.', ['The interface labels simulated activity.', 'Mars and Earth geometry remain separate.', 'Every source claim can be reopened.']),
    ], next: '/story', nextLabel: 'MISSION STORY',
  },
  gallery: {
    eyebrow: 'IMAGE REFERENCES / NASA', title: 'Jezero, seen from orbit and surface.', scene: 'mars',
    deck: 'A source linked image reading room for the places and instruments that motivate the Marswalk concept.',
    stats: [['VIEWS', 'ORBIT + SURFACE'], ['SOURCE', 'NASA'], ['USE', 'REFERENCE']],
    quote: 'An image begins a question. Its full caption supplies the observation context.',
    sections: [
      s('orbital', '01 / ORBIT', 'Jezero from above', 'NASA’s Jezero orbital references show features near the rover’s exploration area.', ['Read the source caption for instrument and scale.', 'The app’s drawn footprint boxes are schematic.', 'Do not treat a page thumbnail as a precision map.'], ['hirise']),
      s('mission', '02 / SURFACE', 'Perseverance image record', 'The mission page connects imagery, updates, and science objectives from the rover’s work.', ['Open the full NASA gallery for image metadata.', 'No image on this page is a live camera stream.', 'Surface photographs and orbital mosaics answer different questions.'], ['perseverance']),
      s('delta', '03 / LAYERING', 'Delta scarp context', 'NASA science highlights include a view of Jezero’s delta scarp.', ['Look for layering in the source image.', 'Read NASA’s interpretation rather than inferring from a thumbnail.', 'Relate images to the broader geology question.'], ['highlights']),
      s('mosaic', '04 / MAP', 'Planetary raster context', 'Mars Trek mosaics provide the map base beneath the route sketch.', ['Tiles have their own resolution and provenance.', 'The route overlay is authored locally.', 'A screenshot does not replace a source dataset.'], ['trek', 'trekApi']),
      s('texture', '05 / GLOBE', 'A NASA/JPL texture', 'The 3D globe uses a Viking derived image texture published by NASA for 3D models.', ['This texture is a visual overview.', 'The pin is approximate.', 'The Trek map remains the geographic working surface.'], ['texture']),
      s('credit', '06 / CREDITS', 'Follow every image back', 'A source page supplies the credit, description, and context that a theater preview cannot contain.', ['Open images at NASA for full details.', 'Keep credit alongside exported imagery.', 'Avoid treating decorative 3D as measured terrain.']),
    ], next: '/story', nextLabel: 'THE FOUR-MINUTE STORY',
  },
  story: {
    eyebrow: 'RECORDING SCRIPT / FOUR MINUTES', title: 'A field question, carried carefully.', scene: 'solar',
    deck: 'The spoken path follows the product: challenge, Jezero, Earth boundary, Marswalk, evidence trace, simulated operations, briefing, and limitations.',
    stats: [['LENGTH', '04:00'], ['STOPS', '12'], ['MODEL CALLS', 'ZERO']],
    quote: 'We use accessible NASA data to ask a better field question and show exactly where the answer comes from.',
    sections: [
      s('opening', '00:00–00:50 / OPEN', 'From challenge to Jezero', '“A future field team needs to understand why a route matters and where its uncertainty begins. Jezero’s ancient lake and delta make it a strong place to ask about past environments.”', ['Show the solar transfer scene.', 'Move from Survival to the Jezero globe.', 'Name the mission source.'], ['objectives']),
      s('earth', '00:50–01:15 / EARTH', 'Keep EONET in its own world', '“The Earth event feed offers a separate comparison lens. These locations are Earth only; they never appear on the Mars map.”', ['Show the Google Earth map if the key is configured.', 'Point to EARTH / EONET labels.', 'Avoid implying Earth events predict Mars hazards.'], ['eonet']),
      s('map', '01:15–02:15 / MARS', 'Load the Marswalk', '“NASA Trek supplies the orbital context. We load a hypothetical traverse, inspect nearby reference points, and read a clearly heuristic score.”', ['Open Explore and run Demo Marswalk.', 'Switch one Trek layer.', 'Show the method badge and caveat.'], ['trekApi']),
      s('answer', '02:15–02:40 / EVIDENCE', 'Ask and trace', '“The default assistant retrieves local NASA notes and assembles a cited answer. The trace shows retrieve, Earth tool decision, grade, and template synthesis.”', ['Open a source link.', 'Show /traces.', 'State that no cloud model is needed.']),
      s('brief', '02:40–03:15 / DELIVERY', 'Simulated ops and server PDF', '“The operations feed is an explicitly simulated WebSocket vignette. The briefing is a deterministic document from route metrics and source notes.”', ['Let one simulated tick arrive.', 'Download the server PDF.', 'Show its caveat and source register.']),
      s('close', '03:15–04:00 / CLOSE', 'Targets, hazards, architecture', '“Seeded points and watch zones make the concept explorable, while the architecture keeps each data boundary clear. This is research storytelling, not navigation.”', ['Show Targets and Hazards.', 'Pause on the architecture orbit.', 'Finish at Science for the method limits.']),
    ], next: '/science', nextLabel: 'VERIFY METHODS',
  },
};
