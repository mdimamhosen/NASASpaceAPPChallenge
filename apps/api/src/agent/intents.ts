/** Deterministic intent rules for the no-LLM planner. Pure so they can be checked in isolation. */
export type Intents = { sols: number[]; route: boolean; earth: boolean; orbit: boolean; knowledge: boolean; briefing: boolean; opendata: boolean; names: boolean; hardware: boolean; time: boolean; comms: boolean; eva: boolean; sites: boolean; power: boolean; los: boolean; energy: boolean; sound: boolean; entry: boolean; samples: boolean; ingenuity: boolean; weather: boolean; date?: string };

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
    orbit: /\b(distance to mars|(earth|mars)[- ](mars|earth) distance|light time|delay|orbit\w*|communicat\w*|signal|how far (is|away)|latency|command|reach mars|travel time)\b/.test(g),
    opendata: /\b(datasets?|data\.nasa\.gov|open data|archives?|catalog\w*|pds|data bundles?|raw data)\b/.test(g),
    hardware: /\b(left (behind|on mars)|went (silent|quiet)|last contact|abandoned|retired|landers?|rovers? (on|left)|spacecraft on mars|hardware|silent)\b/.test(g),
    names: /\b(named|names?|called|nomenclature|iau|gazetteer|features? near|nearby features?|what is near|crater named)\b/.test(g),
    time: /\b(sunrise|sunset|daylight|local (solar |mars )?time|mars time|what time|solar time|season|solar longitude|\bls\b|dust (storm )?season|night)\b/.test(g),
    comms: /\b(conjunction|blackout|comm(s|unication)? (window|blackout|outage)|radio silence|lose contact|out of contact)\b/.test(g),
    eva: /\b(eva|marswalk|spacewalk|suit|oxygen|consumables?|radiation|dose|sievert|msv|walk(ing)? time|on foot|astronauts?)\b/.test(g) && hasEndpoints,
    sites: /\b(habitat|base camp|landing[- ]site (candidates|selection)|where (should|could|can) (we|i|astronauts) (land|build|camp|settle)|best (site|place|spot)s?|suitab\w*|settle\w*|outpost)\b/.test(g),
    power: /\b(solar (power|panels?|array|energy)|insolation|irradiance|sunlight energy|wh\/m)\b/.test(g),
    los: /\b(line of sight|los|see each other|radio (link|contact) between|visible from)\b/.test(g) && hasEndpoints,
    energy: /\b(drive energy|battery|watt[- ]?hours?|wh\b|kwh|power to drive|mmrtg|wheel slip|slip risk)\b/.test(g) && hasEndpoints,
    sound: /\b(sound|speed of sound|acoustic|hear|microphone|supercam mic)\b/.test(g),
    entry: /\b(entry|descent|edl|landing (g|deceleration|physics)|atmospheric density|density of the atmosphere|heat shield|parachute)\b/.test(g),
    samples: /\b(samples?|sample tubes?|cores?|depot|three forks|cached|sample return|msr)\b/.test(g),
    ingenuity: /\b(ingenuity|helicopter|flights?|flew)\b/.test(g),
    weather: /\b(weather|temperature|how cold|how hot|pressure|meda|wind)\b/.test(g),
    date: /\b\d{4}-\d{2}-\d{2}\b/.exec(goal)?.[0],
  };
}

/** Tools the fast planner runs for a set of intents, in plan order. Shared by the agent and its eval. */
export function planTools(r: Intents, goal: string): string[] {
  const needsStart = (r.route || r.eva || r.los || r.energy) && (/landing/i.test(goal) || r.sols.length < 2);
  const tools = [
    ...(r.knowledge ? ['search_knowledge'] : []), ...(r.sols.length || needsStart ? ['rover_position'] : []), ...(r.sols.length ? ['rover_images'] : []),
    ...(r.route || r.eva || r.energy ? ['suggest_corridor', 'analyze_route'] : []), ...(r.briefing ? ['create_briefing'] : []), ...(r.earth ? ['earth_events'] : []),
    ...(r.orbit ? ['orbit_geometry'] : []), ...(r.opendata ? ['nasa_open_data'] : []), ...(r.names ? ['named_features'] : []), ...(r.hardware ? ['mars_hardware'] : []),
    ...(r.time ? ['mars_time'] : []), ...(r.comms ? ['comm_window'] : []), ...(r.eva ? ['eva_budget'] : []), ...(r.sites ? ['site_suitability'] : []), ...(r.power ? ['solar_power'] : []), ...(r.los ? ['line_of_sight'] : []), ...(r.energy ? ['drive_energy'] : []), ...(r.sound ? ['sound_on_mars'] : []), ...(r.entry ? ['entry_physics'] : []), ...(r.samples ? ['mars_samples'] : []), ...(r.ingenuity ? ['ingenuity_flights'] : []), ...(r.weather ? ['weather_on_sol'] : []),
  ];
  return tools.length ? tools : ['search_knowledge'];
}
