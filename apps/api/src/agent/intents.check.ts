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
assert.equal(detectIntents('Earth-Mars distance on 2027-02-19').orbit, true);
assert.equal(detectIntents('Write a mission briefing for a route from landing to sol 700').briefing, true);
assert.equal(detectIntents('Write a report about Mars geology').briefing, false, 'briefing needs route endpoints');

const d = detectIntents('Which data.nasa.gov datasets exist for the Curiosity APXS instrument?');
assert.equal(d.opendata, true);
assert.equal(d.route, false);
assert.equal(detectIntents('What craters are named near the landing site?').names, true);
assert.equal(detectIntents('Where was Perseverance on sol 1000?').opendata, false);
assert.equal(detectIntents('Which NASA landers went silent on Mars, and when was the last contact?').hardware, true);
assert.equal(detectIntents('Where was Perseverance on sol 1000?').hardware, false);
assert.equal(detectIntents('When is sunset at Jezero today?').time, true);
assert.equal(detectIntents('When is the next solar conjunction blackout?').comms, true);
const e = detectIntents('Can astronauts walk from landing to sol 400 within suit time, and what radiation dose?');
assert.equal(e.eva, true);
assert.equal(e.route, true);
assert.equal(detectIntents('What radiation does Mars get?').eva, false, 'EVA budget needs route endpoints');
assert.equal(detectIntents('Where was Perseverance on sol 1000?').time, false);
assert.equal(detectIntents('Where should we build a habitat in Jezero?').sites, true);
assert.equal(detectIntents('Plan a route from the landing site to sol 400.').sites, false, 'the landing site as an endpoint is not a siting question');
assert.equal(detectIntents('Where was Perseverance on sol 1000?').sites, false);
assert.equal(detectIntents('How much solar power would a 10 m² array make at Jezero?').power, true);
assert.equal(detectIntents('Is there line of sight from landing to sol 400?').los, true);
assert.equal(detectIntents('How many Ingenuity flights were there?').ingenuity, true);
assert.equal(detectIntents('Which sample tubes are in the Three Forks depot?').samples, true);
assert.equal(detectIntents('What was the temperature on sol 300?').weather, true);
assert.equal(detectIntents('How fast does sound travel on Mars?').sound, true);
assert.equal(detectIntents('What is the peak deceleration during Mars entry?').entry, true);
assert.equal(detectIntents('Where was Perseverance on sol 1000?').weather, false);
assert.equal(detectIntents('How far did Ingenuity fly?').orbit, false, '"how far" about a flight is not orbit geometry');
assert.equal(detectIntents('How far away is Mars today?').orbit, true);
console.log('intent checks passed');
