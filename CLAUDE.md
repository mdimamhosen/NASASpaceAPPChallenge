# CLAUDE.md

Mars Explorer, a NASA Space Apps 2026 project (challenge 11, Interplanetary Survival Guide: Martian Map). Read `AGENTS.md` first; it holds the product and architecture rules.

## Non-negotiables
- Offline-first: every external call goes through a live → cache → fixture fallback. `OFFLINE=1` forces cache/fixture and disables cloud models.
- Deterministic science (distance, slope, risk, routing, orbits, ranking, provenance matching) is our own code with a `*.check.ts`. Models only retrieve, orchestrate and explain.
- Every NASA fact, coordinate and number carries a source URL or dataset id. Heuristics are labelled NON-CERTIFYING.
- EONET is Earth-only and never touches the Mars map.
- Keep secrets on the API; the browser gets only `NEXT_PUBLIC_*`.
- Record new AI use in `docs/AI_USE.md`. License: Apache-2.0.

## Commands
- `pnpm dev`: web :3000 + API :4000
- `pnpm demo:offline`: the same with `OFFLINE=1`
- `pnpm build`: shared → api → web
- `pnpm refresh:nasa` / `pnpm refresh:opendata`: re-snapshot NASA data with checksums
- Checks: `node apps/api/src/**/<name>.check.ts`, `node apps/web/src/lib/geo.check.ts`, `node packages/shared/src/orbits.check.ts`

## Skills
`.claude/skills/`: space-apps-project, nasa-data-access, evidence-provenance, judging-ready-submission.
