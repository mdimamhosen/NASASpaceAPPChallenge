---
title: NASA Open Data portal — Mars datasets used by Mars Explorer
url: https://data.nasa.gov/dataset/?tags=mars
source: curated
retrievedDate: 2026-10-05
---

# NASA Open Data portal (data.nasa.gov) — Mars datasets

The NASA Open Data portal at data.nasa.gov lists 1321 datasets tagged "mars". Most entries are catalog records for Planetary Data System (PDS) archives from Mars missions and point to PDS landing pages. Mars Explorer snapshots this catalog and searches it so users can find the archive behind a mission or instrument.

## Datasets per mission in the data.nasa.gov Mars catalog

Counts come from matching mission and instrument names in dataset titles and descriptions; a dataset can belong to more than one mission.

- MARS EXPRESS: 302 datasets
- OPPORTUNITY: 183 datasets
- SPIRIT: 183 datasets
- PHOENIX: 110 datasets
- MGS: 107 datasets
- CURIOSITY: 100 datasets
- ODYSSEY: 62 datasets
- MRO: 54 datasets
- MAVEN: 39 datasets
- PATHFINDER: 29 datasets
- VIKING LANDER: 25 datasets
- VIKING ORBITER: 25 datasets
- INSIGHT: 10 datasets

## HiRISE Digital Terrain Models (MRO HiRISE DTM V1.0)

The data.nasa.gov dataset "MRO Mars High Resolution Imaging Science Experiment DTM V1.0" (https://data.nasa.gov/dataset/mro-mars-high-resolution-imaging-science-experiment-dtm-v1-0) describes derived Digital Terrain Models and orthoimages from the HiRISE camera on the Mars Reconnaissance Orbiter. Its PDS DTM cumulative index lists 1315 DTMs with corner coordinates. HiRISE DTMs are built from stereo image pairs and typically have 1 m or 2 m post spacing, far finer than the ~118 m grid Mars Explorer samples from the Mars 2020 PLACES orbital DEM.

Mars Explorer draws every DTM footprint on the Mars map and reports which DTMs cover a drawn route. Near Jezero Crater the index lists 18 DTMs, including:

- DTEEC_002387_1985_003798_1985_A01 — Depositional fan in Jezero Crater (1 m post spacing)
- DTEEC_016364_1980_016219_1980_U01 — Possible MSL landing site in Syrtis Major (1 m post spacing)
- DTEEC_016443_1980_015942_1980_U01 — Possible MSL landing site in northeast Syrtis Major (1 m post spacing)
- DTEEC_016509_1980_016575_1980_U01 — Possible landing site for MSL rover in northeast Syrtis region (1 m post spacing)
- DTEEC_017076_1980_016931_1980_U01 — Candidate MSL landing site in northeast Syrtis Major (1 m post spacing)
- DTEEC_017287_1980_052020_1985_U01 — Candidate MSL landing site in northeast Syrtis Major (1 m post spacing)
- DTEEC_022680_1985_022746_1985_A01 — Possible MSL rover landing site near Jezero Crater (1 m post spacing)
- DTEEC_023247_1985_022957_1985_U01 — Proposed MSR landing site in Jezero Crater (1 m post spacing)
- DTEEC_023524_1985_023379_1985_U01 — Proposed landing site in Jezero Crater (1 m post spacing)
- DTEEC_025370_1980_024513_1980_A01 — Syrtis Major Planum plains (1 m post spacing)
- DTEEC_027902_1975_026280_1975_C01 — Syrtis Major terrain sample (1 m post spacing)
- DTEEC_045994_1985_046060_1985_U01 — Candidate landing site for 2020 mission in Jezero Crater (1 m post spacing)

A HiRISE DTM footprint means finer elevation data exists for that area. Mars Explorer does not sample HiRISE DTM elevations; its Risk Index still uses the coarse PLACES grid and stays non-certifying.

## IAU planetary nomenclature for Mars (Gazetteer of Planetary Nomenclature)

The data.nasa.gov dataset "Gazetteer of Planetary Nomenclature: Mars" (https://data.nasa.gov/dataset/gazetteer-of-planetary-nomenclature-mars-mola-global-images) covers feature names approved by the International Astronomical Union (IAU) Working Group for Planetary System Nomenclature and maintained by the USGS. Mars Explorer loads 2052 IAU-adopted Mars feature center points and labels them on the map.

Named features in and around Jezero Crater include:

- Nili Planum (Planum, 128.55 km): 18.6° N, 77.1° E. Classical albedo feature name.
- Sava Vallis (Vallis, 62 km): 19.09° N, 77.13° E. River in Slovenia.
- Jezero (Crater, 47.52 km): 18.4082° N, 77.6873° E. Town in Bosnia-Herzegovina.
- Pliva Vallis (Vallis, 30 km): 18.67° N, 78.35° E. River in Bosnia and Herzegovina.
- Jezero Mons (Mons, 27 km): 18.16° N, 78.23° E. Named for nearby crater, Jezero.
- Neretva Vallis (Vallis, 17 km): 18.55° N, 77.2° E. River in Bosnia and Herzegovina and Croatia.
- Sedona (Crater, 7.4 km): 17.84° N, 77.54° E. Town in Arizona, USA.
- Una Vallis (Vallis, 5 km): 18.29° N, 77.07° E. River in Bosnia and Herzegovina and Croatia.
- Angelica (Crater, 3.5 km): 18.65° N, 76.95° E. Town in New York, USA.
- Ulricehamn (Crater, 2.34 km): 17.95° N, 76.91° E. Town in Sweden.
- Dacono (Crater, 2.2 km): 18.34° N, 77.95° E. Town in Colorado, USA.
- Marysville (Crater, 1.85 km): 18.13° N, 77.18° E. Town in California, USA.
- Hartwell (Crater, 1.7 km): 18.53° N, 77.72° E. Town in Georgia, USA.
- Belva (Crater, 0.9 km): 18.48° N, 77.38° E. Town in West Virginia, USA.

Jezero is a 47.5 km crater named for a town in Bosnia-Herzegovina. Neretva Vallis and Sava Vallis are the inlet valleys that fed the Jezero delta. Belva is a 0.9 km crater on the delta. Jezero Mons is a mountain on the crater's southeast rim.

## Limits

- Catalog records describe archives; many have no directly downloadable file on data.nasa.gov and link to PDS.
- Mission tags are inferred from names and may miss or over-match datasets.
- Feature center points mark a named feature's center, not its boundary or a landing target.
