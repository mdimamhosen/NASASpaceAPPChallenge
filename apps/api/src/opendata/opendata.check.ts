// Run: node apps/api/src/opendata/opendata.check.ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pointInPolygon, pointSegmentDistanceKm } from '../routes/geo/haversine.ts';
import { densify, detectMission, dtmsInView, featuresInView, inBox, routeContext, searchCatalog, searchTerms } from './opendata.logic.ts';

const data = (name: string) => JSON.parse(readFileSync(new URL(`../../../../data/opendata/${name}`, import.meta.url), 'utf8'));
const catalog = data('catalog.json');
const features = data('iau-features.json').items;
const dtms = data('hirise-dtm.json').items;
const geo = { segmentKm: pointSegmentDistanceKm, inPolygon: pointInPolygon };
const sources = { features: 'f', dtm: 'd' };

// Snapshots are complete and well-formed.
assert.ok(catalog.items.length >= 1000 && catalog.items.length === catalog.total, 'full data.nasa.gov Mars catalog');
assert.ok(features.length > 1500 && features.every((f) => Math.abs(f.lon) <= 180 && Math.abs(f.lat) <= 90), 'IAU names in ±180 east longitude');
assert.ok(dtms.length > 1000 && dtms.every((d) => d.corners.length === 4 && d.pdsUrl.startsWith('https://hirise-pds')), 'HiRISE DTM footprints');

// Bounding boxes, including one that crosses the antimeridian.
assert.equal(inBox(0, 179, { south: -1, north: 1, west: 170, east: -170 }), true);
assert.equal(inBox(0, 0, { south: -1, north: 1, west: 170, east: -170 }), false);

// Labels thin out when zoomed out and Jezero appears when zoomed in.
const jezeroBox = { south: 17.8, north: 19.2, west: 76.8, east: 78.2 };
assert.ok(featuresInView(features, { south: -90, north: 90, west: -180, east: 180 }, 1).every((f) => f.diameterKm >= 500));
assert.ok(featuresInView(features, jezeroBox, 8).some((f) => f.name === 'Belva'), 'sub-km Belva crater at high zoom');
assert.ok(!featuresInView(features, jezeroBox, 3).some((f) => f.name === 'Belva'), 'but not at low zoom');
assert.ok(dtmsInView(dtms, jezeroBox).some((d) => /Jezero/.test(d.rationale)), 'HiRISE DTMs exist over Jezero');

// Catalog search: strict AND for the search box, ranked ANY for plain-language agent goals.
assert.deepEqual(searchTerms('Which datasets exist for the Curiosity APXS?'), ['curiosity', 'apxs']);
const apxs = searchCatalog(catalog.items, 'apxs');
assert.ok(apxs.hits.length > 0 && apxs.hits.every((d) => /apxs|alpha particle/i.test(`${d.title} ${d.id} ${d.notes}`)));
assert.equal(searchCatalog(catalog.items, 'apxs zzzzunmatched').hits.length, 0, 'strict mode needs every term');
assert.ok(searchCatalog(catalog.items, 'apxs zzzzunmatched', undefined, 'any').hits.length > 0, 'any mode ranks partial matches');
const insight = searchCatalog(catalog.items, '', 'INSIGHT');
assert.ok(insight.hits.length > 0 && insight.hits.every((d) => d.missions.includes('INSIGHT')));
assert.ok(insight.missions.length > 5, 'facets are counted before the mission filter');

// Plain-language goals: the named mission narrows the search and common words do not dominate.
assert.equal(detectMission('What did the InSight seismometer record?'), 'INSIGHT');
assert.equal(detectMission('Mars 2020 sample caching'), 'PERSEVERANCE');
assert.equal(detectMission('Gale crater geology'), undefined);
const seis = searchCatalog(catalog.items, 'InSight SEIS seismometer landing site craters', 'INSIGHT', 'any');
assert.ok(seis.hits.length > 0 && seis.hits.every((d) => d.missions.includes('INSIGHT')));
assert.match(seis.hits[0].title, /SEIS/, 'the rare, specific term ranks first');

// Route context: a route across the Jezero delta crosses Belva and sits inside a HiRISE DTM.
const delta = [{ lat: 18.47, lon: 77.37 }, { lat: 18.49, lon: 77.39 }];
const ctx = routeContext(delta, features, dtms, geo, sources);
assert.equal(ctx.namedFeatures[0]?.name, 'Belva', 'nearest named feature first');
assert.ok(ctx.namedFeatures.some((f) => f.name === 'Jezero'), 'the crater containing the route counts');
assert.ok(ctx.hiriseDtms.length > 0 && ctx.hiriseDtms.every((d) => d.coveredShare > 0 && d.coveredShare <= 1));
assert.deepEqual(routeContext(delta.slice(0, 1), features, dtms, geo, sources).namedFeatures, [], 'single point is not a route');
assert.ok(densify(delta).length > 10, 'coverage is measured along the route');

console.log('opendata checks passed');
