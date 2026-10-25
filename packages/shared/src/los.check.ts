// Run: node packages/shared/src/los.check.ts
import assert from 'node:assert/strict';
import { lineOfSight } from './los.ts';

const flat = () => 0;
const a = { lat: 0, lon: 0 }, b = { lat: 0, lon: 0.02 }; // ~1.18 km apart
const r = lineOfSight(flat, a, b)!;
assert.equal(r.clear, true);
assert.ok(Math.abs(r.distanceM - 1183.1) < 1, `distance ${r.distanceM}`);
// A 50 m ridge mid-path blocks 2 m masts.
const ridge = (_: number, lon: number) => (Math.abs(lon - 0.01) < 0.001 ? 50 : 0);
const blocked = lineOfSight(ridge, a, b)!;
assert.equal(blocked.clear, false);
assert.ok(blocked.blockedAtM! > 500 && blocked.blockedAtM! < 600);
// Raising both ends above the ridge clears it.
assert.equal(lineOfSight(ridge, a, b, { heightA: 60, heightB: 60 })!.clear, true);
// Curvature alone hides 2 m masts at ~10 km apart? drop at midpoint = d²/8R ≈ 3.7 m > 2 m.
assert.equal(lineOfSight(flat, a, { lat: 0, lon: 0.17 })!.clear, false, 'horizon over ~10 km');
assert.equal(lineOfSight(() => null, a, b), null);
console.log('los checks passed');
