/** Site-wide voice → UI live sync bus (CustomEvent + tiny React helpers). */

export type VoiceSyncEvent =
  | { type: 'navigate'; href: string }
  | { type: 'explore.sol'; sol: number }
  | { type: 'explore.classroom' }
  | { type: 'explore.analyze' }
  | { type: 'explore.suggest' }
  | { type: 'explore.exportGeo' }
  | { type: 'explore.exportCsv' }
  | { type: 'explore.layer'; layer: string; on?: boolean }
  | { type: 'explore.readRisk' }
  | { type: 'explore.readBriefing' }
  | { type: 'explore.route'; waypoints: Array<{ lat: number; lon: number }> }
  | { type: 'research.ask'; question: string }
  | { type: 'speak'; text: string }
  | { type: 'search.open'; query?: string }
  | { type: 'status'; message: string }
  | { type: 'voice.power'; on: boolean };

const EVENT = 'me-voice-sync';

export function emitVoiceSync(detail: VoiceSyncEvent) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail }));
}

export function onVoiceSync(handler: (event: VoiceSyncEvent) => void) {
  if (typeof window === 'undefined') return () => undefined;
  const listener = (event: Event) => handler((event as CustomEvent<VoiceSyncEvent>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
