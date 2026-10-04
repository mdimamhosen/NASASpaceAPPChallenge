// Run: node apps/web/src/lib/geo.check.ts
import assert from 'node:assert/strict';
import { compareWithTrack, cumulativeKm, haversineKm } from './geo.ts';

// One degree of latitude on Mars ≈ 59.17 km.
assert.ok(Math.abs(haversineKm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }) - 59.17) < 0.01);
const run = cumulativeKm([{ lat: 0, lon: 0 }, { lat: 1, lon: 0 }, { lat: 2, lon: 0 }]);
assert.equal(run[0], 0);
assert.ok(Math.abs(run[2] - 2 * run[1]) < 1e-9);

const track = [{ lat: 18.44, lon: 77.4, sol: 10 }, { lat: 18.45, lon: 77.4, sol: 20 }];
const onTrack = compareWithTrack(track, track)!;
assert.equal(onTrack.withinShare, 1);
assert.equal(onTrack.meanOffsetKm, 0);
const offTrack = compareWithTrack([{ lat: 18.44, lon: 77.5 }], track)!;
assert.equal(offTrack.withinShare, 0);
assert.equal(offTrack.nearestSol, 10);
assert.equal(compareWithTrack([], track), null);
console.log('geo checks passed');
