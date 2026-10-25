// Run: node packages/shared/src/solar-power.check.ts
import assert from 'node:assert/strict';
import { arrayEnergyWh, dailyInsolation, heliocentricAu, MARS_SOL_HOURS, topFlux } from './solar-power.ts';

const near = (a: number, b: number, tol: number, label: string) => assert.ok(Math.abs(a - b) <= tol, `${label}: ${a} vs ${b}`);
// NASA Mars Fact Sheet: mean irradiance 586.2 W/m² at a = 1.52366 AU; perihelion 1.381 AU, aphelion 1.666 AU.
near(1361 / 1.5236915 ** 2, 586.2, 0.3, 'mean irradiance');
near(heliocentricAu(251), 1.3814, 1e-3, 'perihelion distance');
near(heliocentricAu(71), 1.6660, 1e-3, 'aphelion distance');
assert.ok(topFlux(251) > topFlux(71) * 1.4, 'perihelion ≈ 45% brighter than aphelion');
// Equator at equinox (declination 0): daily TOA = S·P/π.
near(dailyInsolation(0, 0), (topFlux(0) * MARS_SOL_HOURS) / Math.PI, 1, 'equinox equator TOA');
assert.equal(dailyInsolation(-85, 90), 0, 'polar night');
assert.ok(dailyInsolation(18.4, 0, 1) < dailyInsolation(18.4, 0, 0.3), 'dust lowers surface energy');
const a = arrayEnergyWh({ latDeg: 18.4, ls: 0, tau: 0.5, areaM2: 1, sols: 100 });
near(a.dustFactor, 0.9972 ** 100, 1e-12, 'dust factor');
console.log('solar-power checks passed', Math.round(dailyInsolation(18.4, 0, 0.5)), 'Wh/m²');
