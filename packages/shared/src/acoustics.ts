/**
 * Sound on Mars. Ideal-gas speed c = √(γRT/M) for CO₂. Perseverance's SuperCam microphone measured ~240 m/s, and
 * ~250 m/s above ~240 Hz because of CO₂ vibrational relaxation (Maurice et al. 2022, Nature 605, 653).
 */
export const MAURICE_2022_URL = 'https://www.nature.com/articles/s41586-022-04679-0';
export const MARS_SOUND_LOW_MS = 240, MARS_SOUND_HIGH_MS = 250, MARS_SOUND_SPLIT_HZ = 240;
const R = 8.314462618;

export const speedOfSound = (temperatureK: number, gamma = 1.31, molarMassKg = 0.04401) => Math.sqrt((gamma * R * temperatureK) / molarMassKg);

/** Arrival delay of a sound over a distance on Mars, using the measured two-speed behaviour. */
export const marsDelaySeconds = (distanceM: number, frequencyHz: number) => distanceM / (frequencyHz > MARS_SOUND_SPLIT_HZ ? MARS_SOUND_HIGH_MS : MARS_SOUND_LOW_MS);
