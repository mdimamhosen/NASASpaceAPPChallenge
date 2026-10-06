/** Deterministic intent rules for the no-LLM planner. Pure so they can be checked in isolation. */
export type Intents = { sols: number[]; route: boolean; earth: boolean; orbit: boolean; knowledge: boolean; briefing: boolean; opendata: boolean; names: boolean; hardware: boolean; date?: string };

export function detectIntents(goal: string): Intents {
  const g = goal.toLowerCase();
  const sols = [...goal.matchAll(/\bsol\s*(\d{1,4})\b/gi)].map((m) => Number(m[1])).slice(0, 3);
  const hasEndpoints = sols.length > 0 || /landing/.test(g);
  return {
    sols,
    knowledge: true,
    briefing: /\b(brief|briefing|report)\b/.test(g) && hasEndpoints,
    route: /\b(route|traverse|path|corridor|drive|walk|marswalk|plan|go from|get from)\b/.test(g) && hasEndpoints,
    // Plain "Earth" ("a command from Earth") is not an Earth-events request.
    earth: /\b(eonet|wildfires?|storms?|volcano(es)?|floods?|sea ice|earth (natural )?events?|natural events?)\b/.test(g),
    orbit: /\b(distance to mars|light time|delay|orbit\w*|communicat\w*|signal|how far|latency|command|reach mars|travel time)\b/.test(g),
    opendata: /\b(datasets?|data\.nasa\.gov|open data|archives?|catalog\w*|pds|data bundles?|raw data)\b/.test(g),
    hardware: /\b(left (behind|on mars)|went (silent|quiet)|last contact|abandoned|retired|landers?|rovers? (on|left)|spacecraft on mars|hardware|silent)\b/.test(g),
    names: /\b(named|names?|called|nomenclature|iau|gazetteer|features? near|nearby features?|what is near|crater named)\b/.test(g),
    date: /\b\d{4}-\d{2}-\d{2}\b/.exec(goal)?.[0],
  };
}
