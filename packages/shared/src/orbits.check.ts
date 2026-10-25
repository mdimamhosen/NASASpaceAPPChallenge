// Run: node packages/shared/src/orbits.check.ts
import assert from 'node:assert/strict';
import { conjunctionWindows, earthMarsGeometry, planetPosition, solarElongationDeg } from './orbits.ts';

// 2003-08-27 closest approach: 0.37272 AU (55.76 million km), per NASA/JPL.
const close = earthMarsGeometry(new Date('2003-08-27T09:51:00Z'));
assert.ok(Math.abs(close.au - 0.3727) < 0.003, `2003 approach ${close.au}`);
// 2018-07-31 approach: ~0.3850 AU.
assert.ok(Math.abs(earthMarsGeometry(new Date('2018-07-31T07:50:00Z')).au - 0.385) < 0.003);
// Earth stays ~1 AU from the Sun; light time at 1 AU ≈ 8.3 min.
const earth = planetPosition('earth', new Date('2026-10-04T00:00:00Z'));
assert.ok(Math.abs(Math.hypot(...earth) - 1) < 0.02);
// Solar conjunctions: 2021-10-08 and 2023-11-18 (NASA Mars mission announcements).
const days = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;
const w = conjunctionWindows(new Date('2021-01-01T00:00:00Z'), new Date('2024-12-31T00:00:00Z'));
assert.equal(w.length, 2, `two conjunctions, got ${JSON.stringify(w)}`);
assert.ok(days(w[0].minDate, '2021-10-08') <= 3, `2021 conjunction ${w[0].minDate}`);
assert.ok(days(w[1].minDate, '2023-11-18') <= 3, `2023 conjunction ${w[1].minDate}`);
assert.ok(solarElongationDeg(new Date('2003-08-28T00:00:00Z')) > 170, 'opposition is far from the Sun');
console.log('orbit checks passed', close.au.toFixed(4));
