// Run: node packages/shared/src/mars-time.check.ts
import assert from 'node:assert/strict';
import { daylightLtst, dustSeason, formatHours, marsTime } from './mars-time.ts';

const near = (a: number, b: number, tol: number, label: string) => assert.ok(Math.abs(a - b) <= tol, `${label}: ${a} vs ${b}`);

// NASA GISS Mars24 worked example 1: 2000-01-06 00:00:00 UTC at 0°.
const a = marsTime(new Date('2000-01-06T00:00:00Z'), 0);
near(a.jdTT, 2451549.50074, 1e-5, 'A JD_TT');
near(a.ls, 277.18758, 1e-4, 'A Ls');
near(a.eot, -5.18774, 1e-4, 'A EOT');
near(a.mst, 23.99425, 1e-4, 'A MST');
near(a.ltst, 23.6484, 1e-4, 'A LTST');
near(a.declination, -25.22825, 1e-4, 'A declination');

// Worked example 2: MER-A Spirit landing, 2004-01-03 13:46:31 UTC, 184.702°W = 175.298°E.
const b = marsTime(new Date('2004-01-03T13:46:31Z'), 360 - 184.702);
near(b.jdTT, 2453008.07471, 2e-5, 'B JD_TT');
near(b.ls, 327.32416, 1e-3, 'B Ls');
near(b.eot, -12.77553, 1e-3, 'B EOT');
near(b.mst, 13.16537, 1e-3, 'B MST');
near(b.lmst, 0.8519, 1e-3, 'B LMST');
near(b.declination, -13.42065, 1e-3, 'B declination');

// Daylight: equator at equinox is 12 h; polar night/day return null.
near(daylightLtst(0, 0)!.hours, 12, 1e-9, 'equinox day');
assert.equal(daylightLtst(85, -24), null);
assert.ok(daylightLtst(18.44, a.declination)!.hours < 12, 'northern winter day is shorter');

assert.equal(dustSeason(250), true);
assert.equal(dustSeason(90), false);
assert.equal(formatHours(23.9999), '00:00');
assert.equal(formatHours(13.5), '13:30');
console.log('mars-time checks passed', a.ls.toFixed(5), b.ls.toFixed(5));
{
  const { sunPosition } = await import('./mars-time.ts');
  const noon = sunPosition(0, 0, 12);
  assert.ok(Math.abs(noon.altitude - 90) < 1e-9, 'equinox noon at equator is overhead');
  assert.ok(Math.abs(sunPosition(18.44, 0, 6).altitude) < 1e-9, 'equinox sunrise altitude 0');
  assert.ok(Math.abs(sunPosition(18.44, 0, 6).azimuth - 90) < 1e-6, 'equinox sunrise due east');
  assert.ok(sunPosition(18.44, 0, 12).azimuth > 170 && sunPosition(18.44, 0, 12).azimuth < 190, 'northern site: noon sun to the south');
}
