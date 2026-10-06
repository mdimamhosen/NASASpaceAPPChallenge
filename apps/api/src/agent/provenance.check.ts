// Run: node apps/api/src/agent/provenance.check.ts
import assert from 'node:assert/strict';
import { checkProvenance, matches, numbersIn } from './provenance.ts';

const evidence = [
  { tool: 'rover_position', source: 'NASA PDS PLACES best_interp.csv', output: { publishedSol: 400, lat: 18.45263, lon: 77.40781, elevationM: -2541.6 } },
  { tool: 'analyze_route', source: 'NASA PDS PLACES orbital DEM', output: { distanceKm: 1.318, riskIndex: 18, dtmCoverage: 0.72 } },
  { tool: 'orbit_geometry', source: 'NASA JPL approximate Keplerian elements', output: { distanceKm: 387213450, lightMinutesOneWay: 21.53 } },
];

// Rounding the answer used is accepted; scale words, percentages of fractions and "/100" scales are understood.
assert.ok(matches(1.32, 2, 1.318, false));
assert.ok(!matches(1.4, 1, 1.318, false));
assert.ok(matches(72, 0, 0.72, true));
assert.deepEqual(numbersIn({ a: [1, '2,500 m and 3.5 million km'] }), [1, 2500, 3.5e6]);

const good = checkProvenance('On sol 400 Perseverance was at 18.4526°N 77.4078°E, -2542 m. The route is 1.32 km, Risk Index 18/100, with 72% DTM coverage. Mars is 387.2 million km away, 21.5 minutes of light time [1].', 'Where was the rover on sol 400?', evidence);
assert.equal(good.complete, true, JSON.stringify(good.claims.filter((c) => c.unmatched)));
assert.ok(good.claims.find((c) => c.value === 1.32)?.tool === 'analyze_route');
assert.ok(!good.claims.some((c) => c.value === 100), 'the /100 score scale is not a claim');
assert.ok(!good.claims.some((c) => c.value === 1 && c.text.includes('[1]')), 'citation markers are not claims');

// An invented number is flagged, and names with digits are not mistaken for quantities.
const bad = checkProvenance('Mars 2020 found 47 sample tubes in 3D, 1.32 km away.', 'tell me about samples', evidence);
assert.equal(bad.complete, false);
assert.deepEqual(bad.claims.filter((c) => c.unmatched).map((c) => c.value), [47]);
assert.equal(bad.unmatched, 1);
assert.ok(bad.evidence.length === 3 && bad.evidence[0].output.includes('18.45263'));

// Bengali digits are checked too: ১.৩২ is 1.32 (matched), ৪৭ is 47 (flagged).
const bn = checkProvenance('পথটি ১.৩২ কিমি, এবং ৪৭টি নমুনা।', 'route', evidence);
assert.deepEqual(bn.claims.map((c) => [c.value, Boolean(c.unmatched)]), [[1.32, false], [47, true]]);

console.log('provenance checks passed');
