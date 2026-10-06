export const JEZERO_CENTER = { lat: 18.44, lon: 77.45 };
export const MARS_RADIUS_KM = 3390;
export const TREK_BASE_URL = 'https://trek.nasa.gov/tiles/Mars/EQ';
export const NASA_PERSEVERANCE_URL = 'https://science.nasa.gov/mission/mars-2020-perseverance/';
export const DATA_NASA_MARS_URL = 'https://data.nasa.gov/dataset/?tags=mars';

/** Approximate published landing coordinates (planetocentric, east longitude) from NASA NSSDCA mission records.
 *  `mission` matches the mission tags inferred for the data.nasa.gov Mars catalog. */
export const NASA_MARS_LANDINGS = [
  { year: 1976, name: 'VIKING 1', mission: 'VIKING LANDER', place: 'Chryse Planitia', lat: 22.27, lon: -47.95 },
  { year: 1976, name: 'VIKING 2', mission: 'VIKING LANDER', place: 'Utopia Planitia', lat: 47.64, lon: 134.29 },
  { year: 1997, name: 'MARS PATHFINDER', mission: 'PATHFINDER', place: 'Ares Vallis', lat: 19.13, lon: -33.22 },
  { year: 2004, name: 'SPIRIT', mission: 'SPIRIT', place: 'Gusev Crater', lat: -14.57, lon: 175.47 },
  { year: 2004, name: 'OPPORTUNITY', mission: 'OPPORTUNITY', place: 'Meridiani Planum', lat: -1.95, lon: -5.53 },
  { year: 2008, name: 'PHOENIX', mission: 'PHOENIX', place: 'Vastitas Borealis', lat: 68.22, lon: -125.75 },
  { year: 2012, name: 'CURIOSITY', mission: 'CURIOSITY', place: 'Gale Crater', lat: -4.59, lon: 137.44 },
  { year: 2018, name: 'INSIGHT', mission: 'INSIGHT', place: 'Elysium Planitia', lat: 4.5, lon: 135.62 },
  { year: 2021, name: 'PERSEVERANCE', mission: 'PERSEVERANCE', place: 'Jezero Crater', lat: 18.4446, lon: 77.4509 }, // PLACES sol 0
] as const;
