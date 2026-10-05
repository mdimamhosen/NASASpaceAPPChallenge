// Run: node packages/shared/src/orbits.check.ts
import assert from 'node:assert/strict';
import { earthMarsGeometry, planetPosition } from './orbits.ts';

// 2003-08-27 closest approach: 0.37272 AU (55.76 million km), per NASA/JPL.
const close = earthMarsGeometry(new Date('2003-08-27T09:51:00Z'));
assert.ok(Math.abs(close.au - 0.3727) < 0.003, `2003 approach ${close.au}`);
// 2018-07-31 approach: ~0.3850 AU.
assert.ok(Math.abs(earthMarsGeometry(new Date('2018-07-31T07:50:00Z')).au - 0.385) < 0.003);
// Earth stays ~1 AU from the Sun; light time at 1 AU ≈ 8.3 min.
const earth = planetPosition('earth', new Date('2026-10-04T00:00:00Z'));
assert.ok(Math.abs(Math.hypot(...earth) - 1) < 0.02);
console.log('orbit checks passed', close.au.toFixed(4));
