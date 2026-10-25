import type { VoiceSyncEvent } from './voice-sync';

export type VoiceCommandResult =
  | { kind: 'sync'; event: VoiceSyncEvent; say?: string }
  | { kind: 'ask'; question: string; say?: string }
  | { kind: 'help'; say: string }
  | { kind: 'power'; on: boolean; say: string }
  | { kind: 'stop'; say: string }
  | { kind: 'describe'; say: string }
  | { kind: 'unknown'; say: string };

const ROUTES: Array<{ re: RegExp; href: string; label: string }> = [
  { re: /\b(explore|marswalk|mars\s*console)\b/i, href: '/explore', label: 'Explore' },
  { re: /\bclassroom\b/i, href: '/classroom', label: 'Classroom' },
  { re: /\b(science|methods?|reproduce)\b/i, href: '/science', label: 'Science' },
  { re: /\b(eonet|earth\s+events?)\b/i, href: '/eonet', label: 'EONET' },
  { re: /\b(research|corpus)\b/i, href: '/research', label: 'Research' },
  { re: /\b(survival|demo\s+tour|tour)\b/i, href: '/survival', label: 'Survival tour' },
  { re: /\b(open\s*data|catalog)\b/i, href: '/opendata', label: 'Open Data' },
  { re: /\bpipeline\b/i, href: '/pipeline', label: 'Pipeline' },
  { re: /\btimeline\b/i, href: '/timeline', label: 'Timeline' },
  { re: /\bvalidation\b/i, href: '/validation', label: 'Validation' },
  { re: /\btargets?\b/i, href: '/targets', label: 'Targets' },
  { re: /\bhazards?\b/i, href: '/hazards', label: 'Hazards' },
  { re: /\bstory\b/i, href: '/story', label: 'Story' },
  { re: /\bjezero\b/i, href: '/jezero', label: 'Jezero' },
  { re: /\bmission\b/i, href: '/mission', label: 'Mission' },
  { re: /\bgallery\b/i, href: '/gallery', label: 'Gallery' },
  { re: /\barchitecture\b/i, href: '/architecture', label: 'Architecture' },
  { re: /\btraces?\b/i, href: '/traces', label: 'Traces' },
  { re: /\bbriefing\b/i, href: '/briefing/preview', label: 'Briefing' },
  { re: /\b(home|landing\s+page)\b/i, href: '/', label: 'Home' },
  { re: /\banalog\b/i, href: '/analog', label: 'Analog' },
];

const NAV_PREFIX = /\b(go(\s+to)?|open|show|take\s+me\s+to|navigate\s+to|bring\s+me\s+to|switch\s+to)\b/i;

const HELP = 'You can say: go explore, open timeline, describe this screen, draw a route from landing to sol 400, when is sunset at Jezero, open classroom, science, eonet, classroom mode, sol 420, show HiRISE, suggest corridor, export geojson, read risk, read briefing, ask why Jezero matters, turn off voice, or what can you do.';

function isQuestion(text: string) {
  return /^(ask|why|what|how|tell|explain|compare|where|when|who|which|is|are|can|could|does|do|will)\b/i.test(text) || /\?\s*$/.test(text);
}

/** Instant local router — zero network. */
export function parseVoiceCommand(raw: string): VoiceCommandResult {
  const text = raw.trim().replace(/\s+/g, ' ');
  if (!text) return { kind: 'unknown', say: 'I did not catch that.' };
  const g = text.toLowerCase();

  if (/\b(turn\s+off\s+voice|power\s+off|disable\s+voice)\b/.test(g)) return { kind: 'power', on: false, say: 'Voice off.' };
  if (/\b(turn\s+on\s+voice|power\s+on|enable\s+voice)\b/.test(g)) return { kind: 'power', on: true, say: 'Voice on.' };

  if (/^(please\s+)?(stop|cancel|quiet|shut\s+up|enough|silence)(\s+(talking|speaking|voice|that|it))?\.?$/i.test(g)
    || /^(stop\s+listening|stop\s+talking)$/i.test(g)) {
    return { kind: 'stop', say: 'Stopped.' };
  }

  if (/^(what can you do|help|list commands|commands)\b/i.test(g)) return { kind: 'help', say: HELP };

  if (/\b(describe|summari[sz]e|read)\s+(this|the|my)\s+(screen|page|view)\b|\bwhat am i looking at\b|\bwhat'?s on (the|this|my) screen\b/.test(g)) {
    return { kind: 'describe', say: 'Describing this screen.' };
  }

  // Route requests go to the agent (corridor + analysis + map update) before sol scrubbing or page navigation.
  if (/\b(route|traverse|marswalk|walk|drive|path|corridor)\b/.test(g) && /\b(sol\s*\d{1,4}|landing)\b/.test(g) && !/^(suggest\s+(dtm\s+)?corridor|suggest\s+route)$/.test(g)) {
    return { kind: 'ask', question: text, say: 'Planning that route with the PLACES DEM.' };
  }

  if (/\b(classroom\s+mode|load\s+places\s+route|demo\s+marswalk)\b/.test(g)) {
    return { kind: 'sync', event: { type: 'explore.classroom' }, say: 'Starting classroom mode on published PLACES sols.' };
  }

  const sol = isQuestion(text) ? null : g.match(/\b(?:sol|scrub(?:\s+to)?)\s*(\d{1,4})\b/) || g.match(/\bgo\s+to\s+sol\s*(\d{1,4})\b/);
  if (sol) {
    const n = Number(sol[1]);
    return { kind: 'sync', event: { type: 'explore.sol', sol: n }, say: `Scrubbing to sol ${n}. Localization from NASA PLACES.` };
  }

  if (/\b(suggest\s+(dtm\s+)?corridor|suggest\s+route)\b/.test(g)) {
    return { kind: 'sync', event: { type: 'explore.suggest' }, say: 'Suggesting a non-certifying DTM corridor.' };
  }
  if (/\b(analyze\s+route|run\s+analysis)\b/.test(g)) {
    return { kind: 'sync', event: { type: 'explore.analyze' }, say: 'Analyzing route with the PLACES DEM.' };
  }
  if (/\bexport\s+geojson\b/.test(g)) return { kind: 'sync', event: { type: 'explore.exportGeo' }, say: 'Exporting GeoJSON.' };
  if (/\bexport\s+csv\b/.test(g)) return { kind: 'sync', event: { type: 'explore.exportCsv' }, say: 'Exporting CSV.' };
  if (/\bread\s+(the\s+)?risk\b|\brisk\s+score\b|\brisk\s+index\b/.test(g)) {
    return { kind: 'sync', event: { type: 'explore.readRisk' }, say: 'Reading the non-certifying risk index.' };
  }
  if (/\bread\s+(the\s+)?briefing\b/.test(g)) {
    return { kind: 'sync', event: { type: 'explore.readBriefing' }, say: 'Reading the mission briefing.' };
  }

  if (/\b(show|hide|toggle)\s+(hirise|hi\s*rise)\b/.test(g)) {
    return { kind: 'sync', event: { type: 'explore.layer', layer: 'hirise', on: !/\bhide\b/.test(g) }, say: 'HiRISE DTM footprints.' };
  }
  if (/\b(show|hide|toggle)\s+(names?|iau)\b/.test(g)) {
    return { kind: 'sync', event: { type: 'explore.layer', layer: 'names', on: !/\bhide\b/.test(g) }, say: 'IAU feature names.' };
  }
  if (/\b(show|hide|toggle)\s+(hardware|left\s+on\s+mars)\b/.test(g)) {
    return { kind: 'sync', event: { type: 'explore.layer', layer: 'hardware', on: !/\bhide\b/.test(g) }, say: 'Left on Mars hardware.' };
  }

  if (/\b(open\s+search|search\s+for|command\s+palette)\b/.test(g)) {
    const q = text.replace(/.*(?:search\s+for|open\s+search)\s*/i, '').trim();
    return { kind: 'sync', event: { type: 'search.open', query: q || undefined }, say: 'Opening search.' };
  }

  const wantsNav = NAV_PREFIX.test(g) || /^(explore|classroom|science|eonet|research|survival|opendata|open data|pipeline|home|analog|timeline|validation|targets|hazards|story|jezero|mission|gallery|architecture|traces|briefing)\b/i.test(g);
  if (wantsNav && !/^ask\b/i.test(g)) {
    // Pure questions with page words ("what is science") should not navigate.
    if (!(isQuestion(text) && !NAV_PREFIX.test(g))) {
      for (const route of ROUTES) {
        if (route.re.test(text)) {
          return { kind: 'sync', event: { type: 'navigate', href: route.href }, say: `Opening ${route.label}.` };
        }
      }
    }
  }

  if (/^ask\b/i.test(text) || isQuestion(text)) {
    const question = text.replace(/^ask\s+/i, '').trim();
    return { kind: 'ask', question, say: 'Checking NASA sources.' };
  }

  if (/\b(perseverance|jezero|places|hirise|mars\s+2020|ingenuity)\b/i.test(text)) {
    return { kind: 'ask', question: text, say: 'Checking NASA sources.' };
  }

  // Anything else with real words goes to the mission agent, which routes it to the right NASA tools.
  if (text.split(' ').length >= 2) return { kind: 'ask', question: text, say: 'Checking NASA sources.' };
  return { kind: 'unknown', say: `I did not catch that. ${HELP}` };
}
