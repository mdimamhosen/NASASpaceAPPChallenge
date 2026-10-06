import { Injectable, Logger } from '@nestjs/common';
import { isOffline } from '../common/offline';
import { detectIntents, type Intents } from './intents';

export type RoutedIntents = Intents & { engine: 'jev' | 'rules'; ms: number; confidence?: Record<string, number> };

type JevAnswer = { type?: string; noul?: number; confidence?: number };

/** Typed yes/no routing questions answered together in one Jev pass. */
const QUESTIONS = {
  knowledge: 'Does answering need facts about NASA Mars missions, Mars science, rover instruments or samples, or this app\'s data sources?',
  route: 'Does the goal ask to plan, draw, or evaluate a route, traverse, or drive on Mars?',
  earth: 'Does the goal ask about current natural events on Earth such as wildfires, storms, floods, or sea ice?',
  orbit: 'Does the goal ask about Earth–Mars distance, signal or command delay, or orbital geometry?',
  briefing: 'Does the goal ask for a mission briefing or written report about a route?',
  opendata: 'Does the goal ask which NASA datasets, archives, or data.nasa.gov catalog records exist for a Mars mission or instrument?',
  hardware: 'Does the goal ask which NASA landers, rovers or helicopters are on Mars, which went silent, or when contact was lost?',
  names: 'Does the goal ask for the official names of Mars surface features such as craters, valleys, or mountains near a place?',
} as const;

/**
 * "System One" router. When Cloudflare credentials are set it asks TypeSafe AI's Jev (Workers AI model `typesafe/jev`)
 * the routing questions in a single parallel pass; otherwise, or on any error, the deterministic intent rules answer instantly.
 * Numbers (sols, dates) always come from regex extraction because Jev returns decisions, not values.
 */
@Injectable()
export class JevRouterService {
  private readonly log = new Logger(JevRouterService.name);
  readonly model = process.env.JEV_MODEL || 'typesafe/jev';

  get available() { return !isOffline() && Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN); }

  async route(goal: string): Promise<RoutedIntents> {
    const started = Date.now();
    const rules = detectIntents(goal);
    if (!this.available) return { ...rules, engine: 'rules', ms: Date.now() - started };
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run`, {
        method: 'POST',
        headers: { authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'content-type': 'application/json' },
        signal: AbortSignal.timeout(4000),
        body: JSON.stringify({
          model: this.model,
          input: {
            state: `Mars Explorer mission-agent goal: ${goal}`,
            questions: Object.fromEntries(Object.entries(QUESTIONS).map(([key, instructions]) => [key, { type: 'noul', instructions }])),
          },
        }),
      });
      if (!res.ok) throw new Error(`Jev HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
      const data = (await res.json()) as { result?: { answers?: Record<string, JevAnswer> }; answers?: Record<string, JevAnswer> };
      const answers = data.result?.answers ?? data.answers;
      if (!answers) throw new Error('Jev response had no answers.');
      const p = (k: keyof typeof QUESTIONS) => (typeof answers[k]?.noul === 'number' ? answers[k]!.noul! : 0);
      const hasEndpoints = rules.sols.length > 0 || /landing/i.test(goal);
      const decided = { route: p('route') >= 0.5 && hasEndpoints, earth: p('earth') >= 0.5, orbit: p('orbit') >= 0.5, briefing: p('briefing') >= 0.5 && hasEndpoints, opendata: p('opendata') >= 0.5, names: p('names') >= 0.5, hardware: p('hardware') >= 0.5 };
      return {
        ...rules, ...decided,
        // Always retrieve unless Jev is confident the goal is purely operational (another tool covers it).
        knowledge: p('knowledge') >= 0.3 || !(decided.route || decided.earth || decided.orbit || rules.sols.length),
        engine: 'jev', ms: Date.now() - started,
        confidence: Object.fromEntries(Object.keys(QUESTIONS).map((k) => [k, Number(p(k as keyof typeof QUESTIONS).toFixed(3))])),
      };
    } catch (error) {
      this.log.warn(`Jev routing failed, using rules: ${(error as Error).message}`);
      return { ...rules, engine: 'rules', ms: Date.now() - started };
    }
  }
}
