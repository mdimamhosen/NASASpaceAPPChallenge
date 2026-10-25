---
name: nasa-data-access
description: Access NASA data for Mars Explorer (PDS PLACES and DEM, Mars Trek WMTS, data.nasa.gov CKAN, HiRISE DTM index, IAU/USGS gazetteer, EONET, GIBS, JPL elements) with caching and offline fallback. Use whenever a feature needs NASA data.
allowed-tools: Read, Bash
license: Apache-2.0
---

# NASA data access

Verified endpoints in use (do not invent others):
- PDS PLACES CSV and orbital DEM: `scripts/refresh-nasa-archives.py`
- data.nasa.gov CKAN `package_search` (tag mars), HiRISE `DTMCUMINDEX.TAB`, IAU Mars nomenclature: `scripts/refresh-open-data.py`
- Mars Trek WMTS: `https://trek.nasa.gov/tiles/Mars/EQ/...` (`packages/shared/src/constants.ts`)
- EONET v3: `https://eonet.gsfc.nasa.gov/api/v3` (Earth only)
- GIBS WMTS: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/<YYYY-MM-DD>/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg` (explicit date; prefer NOAA-20, since Suomi-NPP ends 1 Nov 2026)

## Rules
- Live → cache → fixture via `fetch-fallback.ts`; honour `OFFLINE=1`.
- Snapshots record URL, retrieval time and sha256 in a `SOURCE.json`.
- Keys live in `.env` (API only); commit `.env.example` only.
- Not available: the Mars Rover Photos API (returns 404).
