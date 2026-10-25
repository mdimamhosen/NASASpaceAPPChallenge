/**
 * Solar energy on the Martian surface. Top-of-atmosphere values follow orbital geometry exactly; the dust-attenuated
 * surface value and panel dust loss are heuristics and NON-CERTIFYING.
 * Orbit: a = 1.5236915 AU, e = 0.09341233, perihelion at Ls ≈ 251° (Allison & McEwen 2000).
 * Solar constant 1361 W/m² at 1 AU; Mars mean 586.2 W/m² (NASA Mars Fact Sheet).
 * Dust: Pathfinder measured ~0.28 %/sol array degradation (Landis & Jenkins 2000).
 */
export const SOLAR_CONSTANT = 1361;
export const MARS_SOL_HOURS = 24.6597;
export const DUST_LOSS_PER_SOL = 0.0028;
export const MARS_FACT_SHEET_URL = 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html';

const rad = (d: number) => (d * Math.PI) / 180;

export const heliocentricAu = (ls: number) => (1.5236915 * (1 - 0.09341233 ** 2)) / (1 + 0.09341233 * Math.cos(rad(ls - 251)));
export const topFlux = (ls: number) => SOLAR_CONSTANT / heliocentricAu(ls) ** 2;
const declination = (ls: number) => (Math.asin(0.42565 * Math.sin(rad(ls))) * 180) / Math.PI + 0.25 * Math.sin(rad(ls));

/** Daily energy per m² of horizontal ground, Wh/m², top of atmosphere (tau = 0) or with dust optical depth tau. */
export function dailyInsolation(latDeg: number, ls: number, tau = 0): number {
  const s = topFlux(ls), lat = rad(latDeg), dec = rad(declination(ls));
  let sum = 0;
  const n = 288;
  // Integrate over the sol in hour angle; direct beam follows Beer–Lambert on the slant path, half the scattered light reaches the ground (heuristic).
  for (let i = 0; i < n; i++) {
    const h = -Math.PI + ((i + 0.5) / n) * 2 * Math.PI;
    const mu = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(h);
    if (mu <= 0) continue;
    const direct = Math.exp(-tau / Math.max(mu, 0.05));
    sum += s * mu * (direct + 0.5 * (1 - direct));
  }
  return (sum / n) * MARS_SOL_HOURS;
}

/** Energy a solar array delivers in one sol after `sols` of dust accumulation. */
export function arrayEnergyWh({ latDeg, ls, tau, areaM2, efficiency = 0.28, sols = 0 }: { latDeg: number; ls: number; tau: number; areaM2: number; efficiency?: number; sols?: number }) {
  const insolation = dailyInsolation(latDeg, ls, tau);
  const dustFactor = (1 - DUST_LOSS_PER_SOL) ** sols;
  return { insolationWhM2: insolation, dustFactor, energyWh: insolation * areaM2 * efficiency * dustFactor };
}
