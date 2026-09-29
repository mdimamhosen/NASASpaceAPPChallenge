# Mars Explorer project instructions

Stack: pnpm monorepo — `apps/web` (Next.js + TypeScript + Tailwind), `apps/api` (NestJS modular feature folders + TypeScript), `packages/shared`.

Product flow: landing (EONET Earth feed) → Mars Trek surface console → draw Marswalk → evidence-grounded response with citations → export mission briefing.

Nest modules: `health`, `layers`, `regions`, `routes`, `eonet`, `rag`, `agent`, `briefings`, plus `config` / `common`. Keep domain logic inside its module.

EONET v3 is Earth-only. Never plot EONET geometries on the Mars Trek map. Agent Earth tool output must be labeled EARTH / EONET.

Use the black, white, and gray mission console visual language with square corners. Keep NASA facts and coordinates tied to sources. Mark heuristic terrain data as non-certifying. Keep secrets on the API. Follow the existing contracts in `packages/shared`.

If an implementation session is interrupted, complete the current change or document a compiling continuation in `CONTINUE.md` with phase, task, completed files, remaining work, acceptance, and files not to redo. Resume that exact task before starting new work.
