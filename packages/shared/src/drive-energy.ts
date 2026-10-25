/**
 * Rover drive energy along a DEM profile: lifting work m·g·Δh (climbs only) plus rolling resistance Crr·m·g·d,
 * divided by drivetrain efficiency. NON-CERTIFYING: Crr and efficiency are assumptions.
 * Perseverance mass 1,025 kg; MMRTG ~110 W electrical (NASA Mars 2020 rover pages). Mars g = 3.721 m/s².
 */
export const PERSEVERANCE_MASS_KG = 1025;
export const MMRTG_WATTS = 110;
export const MARS_G = 3.721;

export function driveEnergy(profile: Array<{ km: number; elevationM: number }>, { massKg = PERSEVERANCE_MASS_KG, crr = 0.15, efficiency = 0.5 } = {}) {
  let climbJ = 0, rollJ = 0, maxGrade = 0;
  for (let i = 1; i < profile.length; i++) {
    const d = (profile[i].km - profile[i - 1].km) * 1000, dz = profile[i].elevationM - profile[i - 1].elevationM;
    if (d <= 0) continue;
    if (dz > 0) climbJ += massKg * MARS_G * dz;
    rollJ += crr * massKg * MARS_G * d;
    maxGrade = Math.max(maxGrade, Math.abs(dz / d));
  }
  const electricWh = (climbJ + rollJ) / efficiency / 3600;
  const solWh = MMRTG_WATTS * 24.6597;
  // Slip risk bands: Perseverance is rated for ~30° slopes; loose sand slip grows past ~15°.
  const maxSlopeDeg = (Math.atan(maxGrade) * 180) / Math.PI;
  return { climbWh: climbJ / 3600, rollingWh: rollJ / 3600, electricWh, fractionOfSol: electricWh / solWh, maxSlopeDeg, slipRisk: maxSlopeDeg >= 15 ? 'HIGH' : maxSlopeDeg >= 8 ? 'MODERATE' : 'LOW' } as const;
}
