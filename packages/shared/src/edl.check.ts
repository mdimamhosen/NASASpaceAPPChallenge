// Run: node packages/shared/src/edl.check.ts
import assert from 'node:assert/strict';
import { densityAt, entryProfile, MARS_SCALE_HEIGHT_M, peakDeceleration, speedAt } from './edl.ts';

const near = (a: number, b: number, tol: number, label: string) => assert.ok(Math.abs(a - b) <= tol, `${label}: ${a} vs ${b}`);
near(densityAt(MARS_SCALE_HEIGHT_M) / densityAt(0), 1 / Math.E, 1e-12, 'one scale height');
const input = { entrySpeedMs: 5400, flightPathDeg: 15.5, ballisticKgM2: 120 };
const peak = peakDeceleration(input);
// The analytic peak matches the sampled profile's maximum, at speed Ve/√e.
const sampled = entryProfile(input, 4000).reduce((m, p) => (p.decelMs2 > m.decelMs2 ? p : m));
near(sampled.decelMs2, peak.decelMs2, peak.decelMs2 * 0.01, 'peak deceleration');
near(sampled.altitudeM, peak.altitudeM, 300, 'peak altitude');
near(speedAt(input, peak.altitudeM), peak.speedMs, 1, 'speed at peak');
assert.ok(peak.earthG > 5 && peak.earthG < 20, `Mars entry g-load in range: ${peak.earthG}`);
console.log('edl checks passed', peak.earthG.toFixed(1), 'g at', Math.round(peak.altitudeM / 1000), 'km');
