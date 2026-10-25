import type { LatLon } from './types';
import { MARS_RADIUS_KM } from './constants';
import { conjunctionWindows } from './orbits';
import { evaBudget, type EvaInput } from './eva';

export type SolContract = { id: string; name: string; startSol: number; goalSol: number; goalRadiusKm: number; evaBudgetMinutes: number; riskCap: number; commDate: string; commSource: string };
export type SolContractResult = { distanceKm: number; evaMinutes: number; risk: number; commBlackout: boolean; complete: boolean; score: number; failures: string[] };
export const PLACES_SOURCE = 'https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_rover_places/data_localizations/best_interp.csv';
export const JPL_COMM_SOURCE = 'https://ssd.jpl.nasa.gov/planets/approx_pos.html';
export const SOL_CONTRACTS: SolContract[] = [
  { id: 'first-light', name: 'First light', startSol: 400, goalSol: 409, goalRadiusKm: 0.25, evaBudgetMinutes: 480, riskCap: 65, commDate: '2026-01-15', commSource: JPL_COMM_SOURCE },
  { id: 'delta-edge', name: 'Delta edge', startSol: 700, goalSol: 709, goalRadiusKm: 0.25, evaBudgetMinutes: 480, riskCap: 65, commDate: '2026-10-15', commSource: JPL_COMM_SOURCE },
  { id: 'sample-approach', name: 'Sample approach', startSol: 1000, goalSol: 1007, goalRadiusKm: 0.25, evaBudgetMinutes: 480, riskCap: 65, commDate: '2027-06-15', commSource: JPL_COMM_SOURCE },
  { id: 'western-margin', name: 'Western margin', startSol: 1400, goalSol: 1408, goalRadiusKm: 0.25, evaBudgetMinutes: 480, riskCap: 65, commDate: '2028-03-15', commSource: JPL_COMM_SOURCE },
  { id: 'long-watch', name: 'Long watch', startSol: 1805, goalSol: 1815, goalRadiusKm: 0.25, evaBudgetMinutes: 480, riskCap: 65, commDate: '2029-01-15', commSource: JPL_COMM_SOURCE },
];

const rad = (d: number) => d * Math.PI / 180;
export function marsDistanceKm(a: LatLon, b: LatLon): number {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * MARS_RADIUS_KM * Math.asin(Math.sqrt(h));
}
export function contractCommBlackout(date: string): boolean {
  const day = new Date(`${date}T00:00:00.000Z`);
  const windows = conjunctionWindows(new Date(day.getTime() - 45 * 86400000), new Date(day.getTime() + 45 * 86400000));
  return windows.some((w) => date >= w.start && date <= w.end);
}
export function scoreSolContract(input: { route: LatLon[]; goal: LatLon; risk: number; contract: SolContract; distanceKm?: number; evaProfile?: EvaInput['profile'] }): SolContractResult {
  const calculatedDistance = input.route.slice(1).reduce((sum, point, i) => sum + marsDistanceKm(input.route[i], point), 0);
  const distanceKm = input.distanceKm ?? calculatedDistance;
  const profile: Array<{ km: number; elevationM: number }> = [{ km: 0, elevationM: 0 }];
  let km = 0;
  input.route.slice(1).forEach((point, i) => {
    km += marsDistanceKm(input.route[i], point);
    profile.push({ km, elevationM: 0 });
  });
  const evaMinutes = evaBudget({ profile: input.evaProfile?.length && input.evaProfile.length > 1 ? input.evaProfile : profile, baseKmh: 2, suitHours: 8, reserve: 0.25 }).totalH * 60;
  const commBlackout = contractCommBlackout(input.contract.commDate);
  const goalDistance = input.route.length ? marsDistanceKm(input.route[input.route.length - 1], input.goal) : Infinity;
  const failures: string[] = [];
  if (!Number.isFinite(distanceKm)) failures.push('distance');
  if (input.risk > input.contract.riskCap) failures.push('risk');
  if (evaMinutes > input.contract.evaBudgetMinutes) failures.push('eva');
  if (goalDistance > input.contract.goalRadiusKm) failures.push('goal');
  // Scores reward a completed walk and communicate penalties without implying operational safety.
  const score = Math.max(0, Math.round(1000 - distanceKm * 35 - input.risk * 4 - evaMinutes / 4 - (commBlackout ? 120 : 0)));
  return { distanceKm, evaMinutes, risk: input.risk, commBlackout, complete: failures.length === 0, score, failures };
}
export function contractWaypoints(contractId: string, points: Array<{ sol: number; lat: number; lon: number }>) {
  const contract = SOL_CONTRACTS.find((item) => item.id === contractId);
  if (!contract) return [];
  return points.filter((point) => point.sol >= contract.startSol && point.sol <= contract.goalSol)
    .map((point, i) => ({ id: `sol-${point.sol}-${i}`, lat: point.lat, lon: point.lon }));
}
