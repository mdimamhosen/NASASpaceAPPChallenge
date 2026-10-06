---
name: evidence-provenance
description: Attach a source to every numeric claim and validate agent output before display. Use whenever the assistant or mission agent explains or narrates a result.
allowed-tools: Read
license: Apache-2.0
---

# Evidence and provenance

- RAG answers keep only `[n]` citations that map to retrieved passages (`apps/api/src/rag/answer.service.ts`).
- Agent answers pass `apps/api/src/agent/provenance.ts`: every number must match a number in a sourced tool output. Unmatched numbers are flagged `PROVENANCE INCOMPLETE`, never silently shown as fact.
- The research console's provenance drawer shows claim → tool → source → raw JSON.

## Wording rules
- Report what was measured: "Risk Index 43/100 (dtm-sample), peak sampled slope 15°", not "safe".
- Routes, corridors and the Risk Index are NON-CERTIFYING research aids.
- EONET output is labelled EARTH / EONET and never presented as Mars conditions.
