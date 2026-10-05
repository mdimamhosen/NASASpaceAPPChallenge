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
