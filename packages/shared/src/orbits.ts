/**
 * Heliocentric planet positions from JPL "Keplerian Elements for Approximate Positions of the Major Planets"
 * (E. M. Standish, Table 1, valid 1800–2050). https://ssd.jpl.nasa.gov/planets/approx_pos.html
 * Accuracy is a few thousandths of an AU: fine for visualizing geometry, not for navigation.
 */
export const JPL_APPROX_POS_URL = 'https://ssd.jpl.nasa.gov/planets/approx_pos.html';
export const AU_KM = 149_597_870.7;
export const LIGHT_KM_S = 299_792.458;

type Elements = { a: [number, number]; e: [number, number]; I: [number, number]; L: [number, number]; peri: [number, number]; node: [number, number] };
// [value at J2000, rate per Julian century]; a in AU, angles in degrees.
const ELEMENTS: Record<'earth' | 'mars', Elements> = {
  earth: { a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], I: [-0.00001531, -0.01294668], L: [100.46457166, 35999.37244981], peri: [102.93768193, 0.32327364], node: [0, 0] },
  mars: { a: [1.52371034, 0.00001847], e: [0.0933941, 0.00007882], I: [1.84969142, -0.00813131], L: [-4.55343205, 19140.30268499], peri: [-23.94362959, 0.44441088], node: [49.55953891, -0.29257343] },
};

const rad = (d: number) => (d * Math.PI) / 180;
export const julianDate = (date: Date) => date.getTime() / 86_400_000 + 2_440_587.5;

/** Ecliptic J2000 heliocentric position in AU. Optional meanAnomalyDeg overrides M to trace the orbit. */
export function planetPosition(planet: 'earth' | 'mars', date: Date, meanAnomalyDeg?: number): [number, number, number] {
  const T = (julianDate(date) - 2_451_545) / 36_525;
  const el = ELEMENTS[planet];
  const v = (k: keyof Elements) => el[k][0] + el[k][1] * T;
  const a = v('a'), e = v('e'), I = rad(v('I')), L = v('L'), peri = v('peri'), node = v('node');
  const w = rad(peri - node), O = rad(node);
  let M = meanAnomalyDeg ?? (((L - peri) % 360) + 540) % 360 - 180;
  M = rad(M);
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  return [
    (Math.cos(w) * Math.cos(O) - Math.sin(w) * Math.sin(O) * Math.cos(I)) * xp + (-Math.sin(w) * Math.cos(O) - Math.cos(w) * Math.sin(O) * Math.cos(I)) * yp,
    (Math.cos(w) * Math.sin(O) + Math.sin(w) * Math.cos(O) * Math.cos(I)) * xp + (-Math.sin(w) * Math.sin(O) + Math.cos(w) * Math.cos(O) * Math.cos(I)) * yp,
    Math.sin(w) * Math.sin(I) * xp + Math.cos(w) * Math.sin(I) * yp,
  ];
}

/** Earth–Mars distance in AU and one-way light time in minutes. */
export function earthMarsGeometry(date: Date) {
  const e = planetPosition('earth', date), m = planetPosition('mars', date);
  const au = Math.hypot(m[0] - e[0], m[1] - e[1], m[2] - e[2]);
  return { au, km: au * AU_KM, lightMinutes: (au * AU_KM) / LIGHT_KM_S / 60, earth: e, mars: m };
}

/** Sun–Mars angle as seen from Earth (solar elongation), degrees. Near 0° = solar conjunction. */
export function solarElongationDeg(date: Date): number {
  const e = planetPosition('earth', date), m = planetPosition('mars', date);
  const toSun = e.map((v) => -v), toMars = m.map((v, i) => v - e[i]);
  const dot = toSun.reduce((s, v, i) => s + v * toMars[i], 0);
  return (Math.acos(Math.max(-1, Math.min(1, dot / (Math.hypot(...toSun) * Math.hypot(...toMars))))) * 180) / Math.PI;
}

export type ConjunctionWindow = { start: string; end: string; minDate: string; minDeg: number };

/**
 * Days when Mars sits within `thresholdDeg` of the Sun from Earth: NASA pauses commanding near solar conjunction
 * because solar plasma corrupts radio links. NON-CERTIFYING planning aid; real moratorium dates are set per mission.
 */
export function conjunctionWindows(from: Date, to: Date, thresholdDeg = 3): ConjunctionWindow[] {
  const out: ConjunctionWindow[] = [];
  let cur: ConjunctionWindow | null = null;
  // Scan whole UTC days so the same window comes back whatever time of day `from` is.
  for (let t = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()); t <= to.getTime(); t += 86_400_000) {
    const day = new Date(t), deg = solarElongationDeg(day), iso = day.toISOString().slice(0, 10);
    if (deg < thresholdDeg) {
      if (!cur) cur = { start: iso, end: iso, minDate: iso, minDeg: deg };
      cur.end = iso;
      if (deg < cur.minDeg) { cur.minDeg = deg; cur.minDate = iso; }
    } else if (cur) { out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  return out;
}
