// Run: node packages/shared/src/drive-energy.check.ts
import assert from 'node:assert/strict';
import { driveEnergy, MARS_G } from './drive-energy.ts';

const near = (a: number, b: number, tol: number, label: string) => assert.ok(Math.abs(a - b) <= tol, `${label}: ${a} vs ${b}`);
// 1 km flat: rolling only = 0.15·1025·3.721·1000 J.
const flat = driveEnergy([{ km: 0, elevationM: 0 }, { km: 1, elevationM: 0 }]);
near(flat.rollingWh, (0.15 * 1025 * MARS_G * 1000) / 3600, 1e-9, 'rolling');
assert.equal(flat.climbWh, 0);
assert.equal(flat.slipRisk, 'LOW');
// 100 m climb over 1 km adds m·g·Δh; descending adds nothing.
const up = driveEnergy([{ km: 0, elevationM: 0 }, { km: 1, elevationM: 100 }]);
near(up.climbWh, (1025 * MARS_G * 100) / 3600, 1e-9, 'climb');
assert.equal(driveEnergy([{ km: 0, elevationM: 100 }, { km: 1, elevationM: 0 }]).climbWh, 0);
near(up.electricWh, (up.climbWh + up.rollingWh) / 0.5, 1e-9, 'efficiency');
assert.equal(driveEnergy([{ km: 0, elevationM: 0 }, { km: 0.1, elevationM: 30 }]).slipRisk, 'HIGH');
console.log('drive-energy checks passed', Math.round(flat.electricWh), 'Wh/km flat');
