---
title: Mars Explorer methods, data products, and limits
url: http://localhost:3000/science
mission: Mars Explorer
source: curated
retrievedDate: 2026-10-05
---

## Traverse Risk Index

The Traverse Risk Index is an application-defined score from 0 to 100. It adds four components. The peak sampled grid slope term is the peak slope along the route multiplied by 2.5, capped at 38 points, so it saturates near 15 degrees. The traverse length term is three points per kilometre, capped at 22. The route complexity term is two points per interior waypoint, capped at 12. The missing DTM coverage term is 45 points multiplied by the share of route samples outside the elevation grid. The index uses the dtm-sample method when at least 80 percent of route samples fall inside the grid, and the heuristic method otherwise. Both methods are non-certifying research aids, not safety or navigation guidance.

## Elevation data

Elevation and slope come from the Mars 2020 PLACES orbital DEM product m20_orbital_dem.img, hosted by the NASA PDS Geosciences Node. The app samples the 1 metre source product into a sparse grid with 0.002 degree spacing, roughly 118 metres, covering about 18.416 to 18.508 degrees north and 77.280 to 77.470 degrees east in Jezero Crater. Interpolation smooths local relief, so the grid cannot resolve rocks, small scarps, or other local hazards. The A* suggested corridor searches this coarse grid with slope-weighted distance and is a suggestion only.

## Rover track

The rover track and sol scrubber use the published Mars 2020 PLACES best_interp.csv localization file. It gives interpolated rover positions by sol and spacecraft clock, but no UTC observation date, and it is not live telemetry. Verified mission locations in the app are taken from published PLACES records at sols 0, 400, 700, and 1000.

## Imagery

Map imagery comes from NASA Mars Trek WMTS tile services: MGS MOLA colour shaded relief, the Viking MDIM 2.1 colour mosaic, and MOLA plus HRSC hillshade blends. The 3D terrain view drapes the Mars Trek Jezero landing-site orthomosaics, MRO HiRISE at 25 centimetres and CTX at 6 metres, over the PLACES DEM. Raster colour and hillshade are visual context and are not route measurements.

## Earth data boundary

NASA EONET v3 provides Earth natural event metadata such as wildfires, severe storms, and sea and lake ice. EONET data is Earth only. It is shown on a separate Earth map, labelled EARTH / EONET in assistant answers, and never plotted on the Mars map or used in the Risk Index.

## Retrieval and agents

The research console answers questions with retrieval-augmented generation over a corpus of public NASA pages. Passages are retrieved with hybrid search that fuses BM25 keyword ranking with Gemini embeddings using reciprocal rank fusion and a diversity re-rank. Answers cite passage numbers. Without an API key, the system still answers with an extractive summary of the best passages. The mission agent plans and calls tools for retrieval, route analysis, corridor suggestion, rover position by sol, Earth events, and Earth to Mars orbital geometry.
