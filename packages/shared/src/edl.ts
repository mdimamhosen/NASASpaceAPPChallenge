/**
 * Entry physics with an isothermal exponential atmosphere and the Allen–Eggers ballistic solution. NON-CERTIFYING:
 * real entries fly lifting, guided trajectories. Atmosphere: surface density ~0.020 kg/m³, scale height 11.1 km
 * (NASA Mars Fact Sheet). Perseverance entry speed ~19,500 km/h ≈ 5.4 km/s (NASA Mars 2020 landing press kit).
 */
export const MARS_RHO0 = 0.02;
export const MARS_SCALE_HEIGHT_M = 11_100;

export const densityAt = (altitudeM: number) => MARS_RHO0 * Math.exp(-altitudeM / MARS_SCALE_HEIGHT_M);

export type EntryInput = { entrySpeedMs: number; flightPathDeg: number; ballisticKgM2: number };

/** Allen–Eggers: v(z) = Ve·exp(−ρ(z)·H / (2β·sinγ)). */
export const speedAt = ({ entrySpeedMs, flightPathDeg, ballisticKgM2 }: EntryInput, altitudeM: number) =>
  entrySpeedMs * Math.exp((-densityAt(altitudeM) * MARS_SCALE_HEIGHT_M) / (2 * ballisticKgM2 * Math.sin((flightPathDeg * Math.PI) / 180)));

/** Peak deceleration a = Ve²·sinγ / (2eH), reached where v = Ve/√e, at altitude H·ln(ρ0·H / (β·sinγ)). */
export function peakDeceleration(input: EntryInput) {
  const s = Math.sin((input.flightPathDeg * Math.PI) / 180);
  const decel = (input.entrySpeedMs ** 2 * s) / (2 * Math.E * MARS_SCALE_HEIGHT_M);
  return { decelMs2: decel, earthG: decel / 9.80665, speedMs: input.entrySpeedMs / Math.sqrt(Math.E), altitudeM: MARS_SCALE_HEIGHT_M * Math.log((MARS_RHO0 * MARS_SCALE_HEIGHT_M) / (input.ballisticKgM2 * s)) };
}

/** Speed/density/deceleration samples from 125 km to the ground. */
export function entryProfile(input: EntryInput, steps = 60) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const z = 125_000 * (1 - i / steps), v = speedAt(input, z), rho = densityAt(z);
    return { altitudeM: z, densityKgM3: rho, speedMs: v, decelMs2: (rho * v * v) / (2 * input.ballisticKgM2) };
  });
}
