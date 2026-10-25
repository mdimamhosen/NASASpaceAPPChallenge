/**
 * EVA budget for a Marswalk: walking time out and back, suit-time reserve and radiation dose. NON-CERTIFYING.
 * Radiation: Curiosity RAD measured ~0.67 mSv/day on the surface at Gale (Hassler et al. 2014, Science 343).
 * Slope penalty: Tobler's hiking function shape, normalised to the flat-ground speed; the base speed is an assumption.
 */
export const RAD_SURFACE_MSV_PER_DAY = 0.67;
export const RAD_SOURCE_URL = 'https://www.science.org/doi/10.1126/science.1244797';

export type EvaInput = {
  /** Profile along the route: cumulative distance (km) and elevation (m), in walking order. */
  profile: Array<{ km: number; elevationM: number }>;
  /** Suited walking speed on flat ground, km/h (assumption, default 2). */
  baseKmh?: number;
  /** Suit consumables budget, hours (default 8) and reserve kept back (default 25%). */
  suitHours?: number;
  reserve?: number;
  /** Optional daylight hours available for the walk. */
  daylightHours?: number;
};

export type EvaBudget = {
  outboundH: number; returnH: number; totalH: number; usableH: number; suitHours: number;
  doseMsv: number; steepestGradePct: number; status: 'GO' | 'MARGINAL' | 'NO-GO'; fitsDaylight: boolean | null;
};

const speedFactor = (grade: number) => Math.exp(-3.5 * Math.abs(grade + 0.05)) / Math.exp(-3.5 * 0.05);

export function evaBudget({ profile, baseKmh = 2, suitHours = 8, reserve = 0.25, daylightHours }: EvaInput): EvaBudget {
  let outboundH = 0, returnH = 0, steepest = 0;
  for (let i = 1; i < profile.length; i++) {
    const km = profile[i].km - profile[i - 1].km;
    if (km <= 0) continue;
    const grade = (profile[i].elevationM - profile[i - 1].elevationM) / (km * 1000);
    steepest = Math.max(steepest, Math.abs(grade));
    outboundH += km / (baseKmh * speedFactor(grade));
    returnH += km / (baseKmh * speedFactor(-grade));
  }
  const totalH = outboundH + returnH, usableH = suitHours * (1 - reserve);
  return {
    outboundH, returnH, totalH, usableH, suitHours,
    doseMsv: (RAD_SURFACE_MSV_PER_DAY * totalH) / 24,
    steepestGradePct: steepest * 100,
    status: totalH <= usableH ? 'GO' : totalH <= suitHours ? 'MARGINAL' : 'NO-GO',
    fitsDaylight: daylightHours == null ? null : totalH <= daylightHours,
  };
}

/** Cumulative-distance elevation profile from DEM samples along a route (haversine on the Mars sphere). */
export function routeProfile(samples: Array<{ lat: number; lon: number; elevationM: number }>, radiusKm = 3389.5): EvaInput['profile'] {
  const rad = Math.PI / 180;
  let km = 0;
  return samples.map((p, i) => {
    if (i) {
      const a = samples[i - 1], dLat = (p.lat - a.lat) * rad, dLon = (p.lon - a.lon) * rad;
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(p.lat * rad) * Math.sin(dLon / 2) ** 2;
      km += 2 * radiusKm * Math.asin(Math.sqrt(h));
    }
    return { km, elevationM: p.elevationM };
  });
}
