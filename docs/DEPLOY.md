# Deploy Mars Explorer on Vercel + Render

The recording path runs without a model provider, database, or paid service. The API serves the local Jezero seed and corpus files from the repository. `POSTGIS_ENABLED=false` keeps the explicitly non-certifying heuristic route method.

## 1. Prepare the repository

1. Push the repository to a Git provider connected to both hosts. The pnpm lockfile, `packages/shared`, `data/`, and `apps/` must all be present.
2. Run `pnpm install --frozen-lockfile && pnpm build` locally. The root `.env` and `apps/web/.env.local` are ignored and must stay out of Git.
3. Use Node 22.16 or another supported Node 22 release for Render. `.node-version` records the deployment target; local verification used Node 24.20.

## 2. Render API

1. In Render, choose **New → Blueprint** and select the repository. The root [`render.yaml`](../render.yaml) creates `mars-explorer-api` on the Free plan.
2. Set `CORS_ORIGINS` to the exact Vercel production origin, for example `https://mars-explorer.vercel.app`. You can add comma-separated preview origins if needed. Do not use `*` with the current CORS setup.
3. The blueprint builds the shared contracts and Nest API from the repository root. Its start command changes into `apps/api`, which makes the default `../../data` path resolve to the checked-in seed and corpus. `POSTGIS_ENABLED=false`; no database is required.
4. Wait for `https://<render-service>.onrender.com/health` to return HTTP 200. Record this origin for the web environment.

Render Free services can spin down after idle time and take roughly a minute to restart. Warm the API with `/health` before recording. The default assistant trace is in process memory and resets with the instance. [Render Free plan details](https://render.com/docs/free), [Blueprint reference](https://render.com/docs/blueprint-spec).

## 3. Vercel web

1. In Vercel, choose **Add New → Project**, import the same repository, and set **Root Directory** to `apps/web`.
2. Enable **Include source files outside of the Root Directory in the Build Step** so the web build can read `packages/shared`. The app-local [`vercel.json`](../apps/web/vercel.json) installs with pnpm and builds shared contracts before Next.js. [Vercel monorepo guidance](https://vercel.com/docs/monorepos/monorepo-faq).
3. Add `NEXT_PUBLIC_API_URL=https://<render-service>.onrender.com` for Production (and Preview if used). Do not append a slash.
4. Optional Maps: add `NEXT_PUBLIC_GOOGLE_MAP_API_KEY` to Vercel. Enable **Maps JavaScript API** in Google Cloud and restrict the browser key to the Vercel website origin (and localhost only if needed) plus the Maps JavaScript API. Google Maps Platform may require billing even when usage stays within its no-cost allowance. The Earth explorer still has an OpenStreetMap fallback without this key; the optional Google Trek shell stays disabled. [Google key restrictions](https://developers.google.com/maps/api-security-best-practices).
5. Deploy, then update Render `CORS_ORIGINS` to the final Vercel origin if it changed. Trigger a Render redeploy or restart after an environment change.

`NEXT_PUBLIC_API_URL` and the browser Maps key are compiled into the client bundle, so changing either on Vercel requires a new web deployment. API provider secrets, if ever used, belong only in Render environment variables; cloud models remain opt-in.

## 4. Production smoke

Replace the sample origins below with your own. Run these after both hosts report ready:

```sh
API=https://<render-service>.onrender.com
WEB=https://<vercel-site>.vercel.app
curl -fsS "$API/health"
for route in / /eonet /explore /survival /jezero /ops /briefing/preview; do curl -fsS -o /dev/null -w "%{http_code} $route\n" "$WEB$route"; done
curl -fsS "$API/eonet/events-summary?limit=3&status=open"
```

Then check in a browser: EONET rows and category colors appear, a row opens an Earth detail dialog, Mars Trek tiles load on `/explore`, a demo route returns a `HEURISTIC` badge, a local question has citations, `/ops` says **SIMULATED / NOT ROVER TELEMETRY**, and the server PDF begins with `%PDF`. If Maps is configured, check the Earth Google map and the optional Google Maps shell with NASA Trek tiles. EONET geometries must never appear in the Mars map.

If the API works directly but the browser reports `Failed to fetch`, check `CORS_ORIGINS` first. If the Google map displays an authorization error, inspect key restrictions and the allowed Vercel origin. If the web build cannot find `@mars-explorer/shared`, check the Vercel root directory and outside-root source setting.

## Live deployment status

Local app is final-ready: build, routes, modals, 3D heroes, and deploy configs are in place. Publish with your own Vercel + Render accounts using the steps above, then replace these placeholders:

- API: `https://<render-service>.onrender.com`
- Web: `https://<vercel-site>.vercel.app`

No public deployment is implied until those URLs are filled in after a successful smoke.
