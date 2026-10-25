/**
 * Mars time and sun geometry: NASA GISS Mars24 algorithm (Allison & McEwen 2000).
 * https://www.giss.nasa.gov/tools/mars24/help/algorithm.html
 */
export const MARS24_URL = 'https://www.giss.nasa.gov/tools/mars24/help/algorithm.html';

const rad = (d: number) => (d * Math.PI) / 180;
const mod = (x: number, m: number) => ((x % m) + m) % m;

// TAI−UTC leap seconds (IERS). shortcut: table starts 1996; earlier dates use 30 s, add older rows if pre-1996 dates matter.
const LEAPS: Array<[number, number]> = [
  [Date.UTC(2017, 0, 1), 37], [Date.UTC(2015, 6, 1), 36], [Date.UTC(2012, 6, 1), 35], [Date.UTC(2009, 0, 1), 34],
  [Date.UTC(2006, 0, 1), 33], [Date.UTC(1999, 0, 1), 32], [Date.UTC(1997, 6, 1), 31], [Date.UTC(1996, 0, 1), 30],
];
const ttMinusUtc = (ms: number) => (LEAPS.find(([t]) => ms >= t)?.[1] ?? 30) + 32.184;

const PBS: Array<[number, number, number]> = [
  [0.0071, 2.2353, 49.409], [0.0057, 2.7543, 168.173], [0.0039, 1.1177, 191.837], [0.0037, 15.7866, 21.736],
  [0.0021, 2.1354, 15.704], [0.002, 2.4694, 95.528], [0.0018, 32.8493, 49.095],
];

export type MarsTime = {
  jdTT: number;
  /** Mars Sol Date. */
  msd: number;
  /** Mean solar time at the prime meridian (Coordinated Mars Time), hours. */
  mst: number;
  /** Areocentric solar longitude (season), degrees 0–360. */
  ls: number;
  /** Equation of time, degrees. */
  eot: number;
  /** Solar declination, degrees. */
  declination: number;
  /** Local mean / true solar time at the given east longitude, hours 0–24. */
  lmst: number;
  ltst: number;
};

/** Mars24 steps A–D for a UTC instant and an east-positive longitude. */
export function marsTime(date: Date, lonEast = 0): MarsTime {
  const ms = date.getTime();
  const jdUT = 2440587.5 + ms / 8.64e7;
  const jdTT = jdUT + ttMinusUtc(ms) / 86400;
  const dt = jdTT - 2451545.0;
  const M = 19.3871 + 0.52402073 * dt;
  const aFMS = 270.3871 + 0.524038496 * dt;
  const pbs = PBS.reduce((s, [A, tau, phi]) => s + A * Math.cos(rad((0.985626 * dt) / tau + phi)), 0);
  const nuM = (10.691 + 3.0e-7 * dt) * Math.sin(rad(M)) + 0.623 * Math.sin(rad(2 * M)) + 0.05 * Math.sin(rad(3 * M)) + 0.005 * Math.sin(rad(4 * M)) + 0.0005 * Math.sin(rad(5 * M)) + pbs;
  const ls = mod(aFMS + nuM, 360);
  const eot = 2.861 * Math.sin(rad(2 * ls)) - 0.071 * Math.sin(rad(4 * ls)) + 0.002 * Math.sin(rad(6 * ls)) - nuM;
  const msd = (jdTT - 2451549.5) / 1.0274912517 + 44796.0 - 0.0009626;
  const mst = mod(24 * msd, 24);
  const lmst = mod(mst + lonEast / 15, 24);
  const ltst = mod(lmst + eot / 15, 24);
  const declination = (Math.asin(0.42565 * Math.sin(rad(ls))) * 180) / Math.PI + 0.25 * Math.sin(rad(ls));
  return { jdTT, msd, mst, ls, eot, declination, lmst, ltst };
}

/** Sunrise/sunset in local true solar time (hours) for a latitude; null when the sun never rises or never sets. */
export function daylightLtst(latDeg: number, declinationDeg: number): { sunrise: number; sunset: number; hours: number } | null {
  const c = -Math.tan(rad(latDeg)) * Math.tan(rad(declinationDeg));
  if (c >= 1 || c <= -1) return null;
  const h0 = (Math.acos(c) * 180) / Math.PI / 15;
  return { sunrise: 12 - h0, sunset: 12 + h0, hours: 2 * h0 };
}

/**
 * Season context: Mars global and regional dust storms cluster in southern spring/summer (Ls ~180–330, perihelion side).
 * NON-CERTIFYING climatology flag, not a forecast.
 */
export const dustSeason = (ls: number) => ls >= 180 && ls < 330;

export const formatHours = (h: number) => { const t = Math.round(mod(h, 24) * 60); return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };

/** Sun altitude and azimuth (degrees, azimuth clockwise from north) at a latitude for a solar declination and local true solar time. */
export function sunPosition(latDeg: number, declinationDeg: number, ltstHours: number): { altitude: number; azimuth: number } {
  const lat = rad(latDeg), dec = rad(declinationDeg), h = rad((ltstHours - 12) * 15);
  const sinAlt = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(h);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const az = Math.atan2(-Math.sin(h) * Math.cos(dec), Math.cos(lat) * Math.sin(dec) - Math.sin(lat) * Math.cos(dec) * Math.cos(h));
  return { altitude: (alt * 180) / Math.PI, azimuth: mod((az * 180) / Math.PI, 360) };
}

/** Fixed points of the Martian year in solar longitude Ls (degrees). Perihelion/aphelion per Allison & McEwen 2000. */
export const MARS_SEASON_MARKS = [
  { ls: 0, label: 'Northern spring equinox' }, { ls: 71, label: 'Aphelion' }, { ls: 90, label: 'Northern summer solstice' },
  { ls: 180, label: 'Northern autumn equinox' }, { ls: 251, label: 'Perihelion' }, { ls: 270, label: 'Northern winter solstice' },
] as const;
