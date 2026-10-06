---
name: space-apps-project
description: Work on Mars Explorer as a NASA Space Apps 2026 project. Use when adding a feature, wiring NASA data, or preparing the demo and submission, to keep it offline-first, cited, deterministic and judged-ready.
license: Apache-2.0
---

# Space Apps 2026 project (Mars Explorer)

## Steps for any feature
1. Put domain logic in its NestJS module under `apps/api/src/<domain>/`; add shared types to `packages/shared/src/types.ts`.
2. Fetch NASA data through `apps/api/src/common/fetch-fallback.ts` (live → cache → fixture) or a checksummed snapshot under `data/` with a refresh script.
3. Keep any computation in a pure `*.logic.ts` or helper with a `*.check.ts` next to it. The model never computes a number.
4. Show the source (link or dataset id) and the LIVE/CACHE/FIXTURE badge in the UI.
5. Run `pnpm build` and every check; then `pnpm demo:offline` with the network off.
6. Update `docs/AI_USE.md`, `docs/SUBMISSION.md` and the README data table.

## Guardrails
- Apache-2.0, public repository, no under-18 likeness in any media.
- Mark heuristics NON-CERTIFYING; never invent coordinates.
