// Run: node apps/api/src/agent/intents.check.ts
import assert from 'node:assert/strict';
import { detectIntents } from './intents.ts';

const a = detectIntents('Plan a route from the landing site to sol 400 and tell me how long a command from Earth takes to reach Mars.');
assert.deepEqual(a.sols, [400]);
assert.equal(a.route, true);
assert.equal(a.earth, false, '"from Earth" is not an Earth-events request');
assert.equal(a.orbit, true);

const b = detectIntents('What wildfires and storms is NASA EONET tracking?');
assert.equal(b.earth, true);
assert.equal(b.route, false);

const c = detectIntents('Where was Perseverance on sol 1000?');
assert.deepEqual(c.sols, [1000]);
assert.equal(c.route, false, 'a position question is not a route');

assert.equal(detectIntents('Earth-Mars distance on 2027-02-19').date, '2027-02-19');
assert.equal(detectIntents('Write a mission briefing for a route from landing to sol 700').briefing, true);
assert.equal(detectIntents('Write a report about Mars geology').briefing, false, 'briefing needs route endpoints');
console.log('intent checks passed');
