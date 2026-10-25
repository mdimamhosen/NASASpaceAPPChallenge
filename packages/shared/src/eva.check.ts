// Run: node packages/shared/src/eva.check.ts
import assert from 'node:assert/strict';
import { evaBudget, RAD_SURFACE_MSV_PER_DAY, routeProfile } from './eva.ts';

const near = (a: number, b: number, tol: number, label: string) => assert.ok(Math.abs(a - b) <= tol, `${label}: ${a} vs ${b}`);

// Flat 2 km at 2 km/h: 1 h out, 1 h back (Tobler is normalised so flat = base speed).
const flat = evaBudget({ profile: [{ km: 0, elevationM: 0 }, { km: 2, elevationM: 0 }] });
near(flat.outboundH, 1, 1e-9, 'flat out');
near(flat.totalH, 2, 1e-9, 'flat total');
near(flat.doseMsv, (RAD_SURFACE_MSV_PER_DAY * 2) / 24, 1e-12, 'dose');
assert.equal(flat.status, 'GO');

// Uphill out is slower than downhill back; a 10% grade shows up as the steepest grade.
const hill = evaBudget({ profile: [{ km: 0, elevationM: 0 }, { km: 1, elevationM: 100 }] });
assert.ok(hill.outboundH > hill.returnH, 'uphill slower');
near(hill.steepestGradePct, 10, 1e-9, 'grade');

// Status thresholds: usable = 8 h × 75% = 6 h.
assert.equal(evaBudget({ profile: [{ km: 0, elevationM: 0 }, { km: 7, elevationM: 0 }] }).status, 'MARGINAL'); // 7 h
assert.equal(evaBudget({ profile: [{ km: 0, elevationM: 0 }, { km: 9, elevationM: 0 }] }).status, 'NO-GO'); // 9 h
assert.equal(evaBudget({ profile: [{ km: 0, elevationM: 0 }, { km: 2, elevationM: 0 }], daylightHours: 1 }).fitsDaylight, false);
// 1° of latitude on Mars = 2π·3389.5/360 ≈ 59.16 km.
const prof = routeProfile([{ lat: 0, lon: 0, elevationM: 5 }, { lat: 1, lon: 0, elevationM: 9 }]);
near(prof[1].km, 59.158, 1e-3, 'profile km');
assert.equal(prof[1].elevationM, 9);
console.log('eva checks passed');
