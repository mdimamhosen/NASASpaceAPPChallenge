# Senior polish — continuation

## Status

Codex cinematic heroes restored (full-bleed 3D + blended left/bottom scrim). EONET now warm-caches **full** upstream payloads to `data/eonet/` + Postgres (`eonet_cache`) when `DATABASE_URL` works; snapshots kept until content hash changes; last-good served on mobile/flaky upstream failure.

## Completed this turn

- Cleaned conflicting `.landing-hero` rules so Codex blended hero wins
- Photo plane moved under the hero (soft blend) instead of fighting the 3D scrim
- `EonetDurableStore` + boot warm of events/geojson/categories/sources/layers/magnitudes
- SQL: `data/jezero/postgis/002_eonet_cache.sql`

## Remaining (optional)

- Connect free Vercel + Render and smoke production URLs
- Start Postgres locally if you want DB cache in addition to file cache: `docker compose --profile database up -d`

## Do not redo

- DetailModal / EarthEventsExplorer cascade
- Cinematic hero structure (`landing-hero` + `dossier-hero-cinematic`)
- Deploy docs / video script
