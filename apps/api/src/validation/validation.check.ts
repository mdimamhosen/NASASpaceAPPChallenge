// Run: node apps/api/src/validation/validation.check.ts
import assert from 'node:assert/strict';
import { mulberry32, offsetStats, quantile, slopeStats, toolScore } from './validation.logic.ts';

const r1 = mulberry32(42), r2 = mulberry32(42);
const a = [r1(), r1(), r1()];
assert.deepEqual(a, [r2(), r2(), r2()], 'seeded RNG is reproducible');
assert.ok(a.every((v) => v >= 0 && v < 1));
assert.equal(quantile([0, 10], 0.5), 5);
const s = slopeStats([1, 2, 3, 12, 20]);
assert.equal(s.n, 5); assert.equal(s.p50, 3); assert.equal(s.max, 20);
assert.equal(s.over10, 0.4); assert.equal(s.over15, 0.2);
assert.equal(slopeStats([]).mean, 0);
const o = offsetStats([0.1, 0.3]);
assert.equal(o.withinShare, 0.5); assert.ok(Math.abs(o.meanKm - 0.2) < 1e-12);
assert.deepEqual(toolScore(['mars_time'], ['search_knowledge', 'mars_time']), { pass: true, recall: 1, precision: 1 });
assert.equal(toolScore(['comm_window'], ['orbit_geometry']).pass, false);
console.log('validation checks passed');
