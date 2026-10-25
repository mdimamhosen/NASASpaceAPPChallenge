import assert from 'node:assert/strict';
import { contractCommBlackout, contractWaypoints, scoreSolContract, SOL_CONTRACTS } from '../dist/sol-contract.js';

const mission = SOL_CONTRACTS[0];
const places = [{ sol: 400, lat: 18.46194359, lon: 77.436105497 }, { sol: 401, lat: 18.461595988, lon: 77.432977706 }, { sol: 409, lat: 18.453946131, lon: 77.410418986 }];
const route = contractWaypoints(mission.id, places);
assert.equal(route.length, 3, 'contract route uses only published points inside its sol window');
const passed = scoreSolContract({ route, goal: route.at(-1)!, risk: 20, contract: mission });
assert.equal(passed.complete, true, 'valid route can complete a contract');
assert.equal(passed.failures.length, 0);
const failed = scoreSolContract({ route: [route[0], { ...route[0], lat: route[0].lat + 1 }, route.at(-1)!], goal: route.at(-1)!, risk: 99, contract: mission });
assert.equal(failed.complete, false, 'risk and EVA breaches fail a contract');
assert.ok(failed.failures.includes('risk'));
assert.ok(failed.failures.includes('eva'));
assert.equal(contractWaypoints('missing', places).length, 0);
assert.equal(typeof contractCommBlackout('2026-01-15'), 'boolean');
console.log('Sol Contract checks passed');
