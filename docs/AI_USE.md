# Use of AI in Mars Explorer

Mars Explorer is built for the NASA Space Apps Challenge 2026, challenge 11 ("Interplanetary Survival Guide: Martian Map"). This file lists every AI tool we used, what the AI did, what it did not do, and where the prompts live.

## The boundary

**Deterministic code computes; the model only retrieves, orchestrates and explains.** No language model ever produces a number that appears in the interface.

| Computed in our own code (no model) | File |
|---|---|
| Route distance (haversine, Mars radius 3,390 km) | `apps/api/src/routes/geo/haversine.ts` |
| DEM sampling, slope, Traverse Risk Index, A* corridor | `apps/api/src/routes/dtm.service.ts`, `routes.service.ts` |
| Named features and HiRISE DTM coverage along a route | `apps/api/src/opendata/opendata.logic.ts` |
| Catalog search, mission tagging, label declutter | `opendata.logic.ts`, `scripts/refresh-open-data.py` |
| Earth–Mars distance and light time (JPL elements) | `packages/shared/src/orbits.ts` |
| Retrieval ranking: BM25, reciprocal rank fusion, MMR | `apps/api/src/rag/ranking.ts` |
| Citation validation and the numeric provenance check | `apps/api/src/rag/answer.service.ts`, `apps/api/src/agent/provenance.ts` |
| Sol Contract route gates and game score | `packages/shared/src/sol-contract.ts` (deterministic code; no model call) |

Each of these has a runnable check (`*.check.ts`); see the README.

## AI tools used

| Tool | Where | What it did |
|---|---|---|
| **Claude Code** (Anthropic) | Development | Scaffolding, refactoring, code review, documentation drafts, the video pipeline scripts. Every change was reviewed and tested by the team. |
| **Gemini** (`gemini-2.5-flash`, Google) | In-app, optional | Writes the cited answer for the research assistant and plans tool calls for the mission agent (deep mode). Off by default; the user opts in. |
| **Claude** (`claude-opus-5-5`, Anthropic) | In-app, optional | Fallback writer when Gemini is unavailable. |
| **Gemini embeddings** (`gemini-embedding-001`) | In-app | Embeds NASA corpus passages for semantic retrieval. |
| **TypeSafe AI Jev** (Cloudflare Workers AI), optional | In-app | Yes/no routing questions for the agent's fast mode. Without credentials, deterministic regex rules route instead. |
| **Gemini Live** (`gemini-3.8-live`, fallback `gemini-2.5-flash-native-audio-latest`) | In-app voice, Tier 1 | Real-time spoken conversation through the API relay (`apps/api/src/voice/live.gateway.ts`). The model only listens, calls our tools and speaks their results. Every number it says is checked by the provenance gate. Audio is relayed, never stored, and the key stays on the API. |
| **Gemini transcription** (`gemini-3.5-transcribe`, fallback `gemini-2.5-flash`) | In-app voice, Tier 2 | Push-to-talk speech to text (`POST /voice/transcribe`). |
| **Gemini TTS** (`gemini-3.8-flash-tts`, fallback `gemini-2.5-flash-preview-tts`) | In-app voice | Spoken answers, streamed sentence by sentence (`POST /voice/speak/stream`). Offline, the browser's own voices speak instead. |
| **Gemini TTS** (`gemini-2.5-flash-preview-tts`, voice "Sulafat") | Video only | Narration voice for the 4-minute video. |
| **Gemini** (`gemini-2.5-flash`) | Video QA only | Transcribed narration back to check pronunciation. |

With no API keys, or with `OFFLINE=1`, the app runs fully without any model: local extractive answers, deterministic planning, and the same numbers.

## What the AI did not do

- It did not compute any statistic, distance, slope, elevation, risk score, route, orbit, Mars time, conjunction window, EVA time or radiation dose. Those come from our own checked modules in `packages/shared/src` (`mars-time`, `orbits`, `eva`, `suitability`, `solar-power`, `edl`, `los`, `drive-energy`, `acoustics`).
- It did not choose or invent coordinates. Coordinates come from NASA PDS PLACES, the PLACES orbital DEM, the IAU/USGS gazetteer, the HiRISE DTM index or NSSDCA.
- It did not select our datasets or design the method. The team chose the NASA products and the evidence-first design.
- Model answers are shown only with citations that point at real retrieved passages. Every number in an agent answer is checked against tool results (`agent/provenance.ts`), and unmatched numbers are flagged in the interface.

## Prompts

| Prompt | Location |
|---|---|
| Research assistant (cited RAG answer) | `apps/api/src/rag/answer.service.ts` (`SYSTEM`) |
| Mission agent (tool use, rules, citation format) | `apps/api/src/agent/mission-agent.service.ts` (`SYSTEM`, `TOOLS`) |
| Jev routing questions | `apps/api/src/agent/jev-router.service.ts` (`QUESTIONS`) |
| Bangla answer instruction | `apps/api/src/rag/answer.service.ts`, `mission-agent.service.ts` (`langInstruction`) |
| Live voice assistant (tools, rounding, non-certifying rules) | `apps/api/src/voice/live.gateway.ts` (`system`, `CLIENT_TOOLS`) |
| Video narration and voice style | `docs/video/pipeline/script.json` |

## Data the AI worked on

Only NASA and partner sources listed in `README.md` and `docs/SUBMISSION.md`: the 23-document NASA corpus in `data/corpus/`, and tool outputs from PLACES, the orbital DEM, data.nasa.gov snapshots, EONET (Earth only) and JPL elements.

## Our own work

The evidence-first design, the dataset selection and verification, the Traverse Risk Index, the corridor search, the open-data integration, the 3D scenes, the interface and the narrative are the team's own work: Md Imam Hosen (architecture and engineering), Md Ahad (NASA data research and verification), Biswadev Biswas (3D/UI design and QA).
