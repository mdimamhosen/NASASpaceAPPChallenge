# Space Apps build-guide features + full-coverage video — complete

## Phase and task
Plan: `/Users/mdimam/.claude/plans/https-docs-google-com-document-d-1kavazq-steady-island.md`.
Phase A (features from the Space Apps 2026 Bangladesh build guide), then Phase B (regenerate the 4:00 video with every page/3D/component and a beat for each new feature).

## Phase A tasks
- A1 compliance: LICENSE (Apache-2.0), docs/AI_USE.md, docs/SUBMISSION.md, CLAUDE.md, .claude/skills/*
- A5 GIBS Earth basemap (EarthMiniMap, EonetEarthMap)
- A4 Left-on-Mars hardware layer + last-contact scrubber (data/mars-hardware.json, /opendata/hardware)
- A3 provenance gate + drawer (agent/provenance.ts, AgentRun.provenance, ResearchConsole drawer)
- A2 OFFLINE=1 mode + source badges (common/fetch-fallback.ts)
- A6 Bangla answers (lang=bn on rag/agent, BN switch)

## Completed files
Phase A complete and verified (builds, all checks, API smoke, offline smoke on :4100, CDP screenshots):
- A1: LICENSE, docs/AI_USE.md, docs/SUBMISSION.md, CLAUDE.md, .claude/skills/* (4), package.json license fields
- A2: apps/api/src/common/offline.ts; OFFLINE in eonet.service (+ widest-snapshot trim), eonet-durable.store (fixture tier, data/fixtures/eonet), llm/embedder/jev/retriever/opendata/health; SourceBadge; pnpm demo:offline
- A3: agent/provenance.ts + check; AgentRun.provenance; ResearchConsole ProvenanceDrawer
- A4: data/mars-hardware.json (sourced from science.nasa.gov pages), /opendata/hardware, mars_hardware agent tool + intent, MarsMap HardwareLayer, ExploreConsole timeline + modal, data/corpus/nasa-left-on-mars.md, science register row
- A5: lib/gibs.ts, EarthMiniMap + EonetEarthMap on GIBS VIIRS NOAA-20 (Google opt-in), science register row
- A6: lang on rag/agent DTOs, langInstruction (rag/answer.service.ts), EN|বাংলা switch
Deviation: no generic fetch-fallback.ts (EONET + opendata already have live→cache→fixture tiers; a wrapper would have no callers).

## Phase B complete
docs/video/team/binary-explorers-mars-explorer.mp4 (+ .srt): 240.000 s, 1080p30, 19 scenes, 53 clips (55 online + 2 OFFLINE=1 shots recorded), grid walls + cards + click rings. Previous cuts in docs/video/team/previous/. Pipeline saved in docs/video/pipeline (node broll.mjs; node broll.mjs --offline).
App fix found while recording: MarsMap invalidates Leaflet size on container resize (focus mode left untiled space).

## Acceptance
pnpm build passes; all *.check.ts pass; API smoke for hardware/provenance/offline; CDP screenshots; then video at exactly 240.000 s.

## Do not redo
NASA Open Data module, map overlays, /opendata page, previous video pipeline (docs/video/pipeline) — extend, don't rewrite.
