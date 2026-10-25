// Run: node packages/shared/src/suitability.check.ts
import assert from 'node:assert/strict';
import { slopeGrid, suitability } from './suitability.ts';

const spacing = 0.002; // ~118 m on Mars
const cell = spacing * (Math.PI / 180) * 3389.5 * 1000;
// Plane rising 10% eastward → ~5.71° everywhere.
const plane = Array.from({ length: 5 }, () => Array.from({ length: 5 }, (_, x) => x * cell * 0.1));
const s = slopeGrid({ rows: plane, sampleSpacingDegrees: spacing, latMin: 0 });
assert.ok(Math.abs(s[2][2]! - 5.7106) < 0.01, `plane slope ${s[2][2]}`);
assert.equal(slopeGrid({ rows: [[null, 1], [1, 1]], sampleSpacingDegrees: spacing, latMin: 0 })[0][0], null);

// Flat west half, steep cliff east half: the best site is on the flat side near the target.
const rows = Array.from({ length: 6 }, () => Array.from({ length: 10 }, (_, x) => (x < 5 ? 0 : (x - 4) * cell * 0.6)));
const r = suitability({ latMin: 0, lonMin: 0, sampleSpacingDegrees: spacing, rows, targets: [{ lat: 0.004, lon: 0.002 }], track: [] });
assert.ok(r.best[0].lon < 5 * spacing, 'best site is on the flat half');
assert.equal(r.cells[3][8], 0, 'cells steeper than 15° score 0');
assert.ok(r.best.every((a, i) => r.best.slice(i + 1).every((b) => Math.hypot(a.lat - b.lat, a.lon - b.lon) > 0)), 'distinct sites');
assert.ok(r.best[0].score > 0 && r.best[0].score <= 100);
// Zero science weight changes the ranking basis but stays in range.
const z = suitability({ latMin: 0, lonMin: 0, sampleSpacingDegrees: spacing, rows, targets: [], track: [] }, { slope: 1, roughness: 0, elevation: 0, science: 0, trafficable: 0 });
assert.ok(Math.abs(z.best[0].score - 100) < 1e-9, 'perfectly flat cell scores 100 on slope alone');
console.log('suitability checks passed', r.best[0].score.toFixed(1));
