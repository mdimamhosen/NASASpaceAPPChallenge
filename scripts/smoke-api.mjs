#!/usr/bin/env node
/** OFFLINE API smoke: fail on any non-2xx. Usage: API_URL=http://localhost:4000 node scripts/smoke-api.mjs */
const base = process.env.API_URL || 'http://localhost:4000';
const points = [
  { id: 'a', lat: 18.4447, lon: 77.4508 },
  { id: 'b', lat: 18.46, lon: 77.43 },
];

async function hit(method, path, body, accept = null) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const ok = accept ? accept.includes(res.status) : res.status >= 200 && res.status < 300;
  if (!ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  console.log(`OK ${res.status} ${method} ${path}`);
  return text;
}

const checks = [
  () => hit('GET', '/health/ready'),
  async () => { const t = JSON.parse(await hit('GET', '/places/perseverance')); if (!(t.points?.length > 100)) throw new Error('/places/perseverance returned no track points'); },
  async () => { const t = JSON.parse(await hit('GET', '/places/curiosity')); if (!(t.points?.length > 100)) throw new Error('/places/curiosity returned no track points'); },
  () => hit('GET', '/regions/gale'),
  () => hit('GET', '/opendata/mission/samples'),
  () => hit('GET', '/opendata/mission/ingenuity'),
  () => hit('POST', '/routes/analyze', { waypoints: points }),
  () => hit('POST', '/routes/suggest', { waypoints: points }),
  () => hit('GET', '/raw-images/perseverance?sol=420&limit=3'),
  () => hit('POST', '/briefings', { waypoints: points }),
  () => hit('GET', '/briefings/classroom-worksheet?lang=en'),
  () => hit('GET', '/rag/status'),
  () => hit('GET', '/validation/report'),
  () => hit('GET', '/agent/tools'),
  () => hit('POST', '/voice/speak', { text: 'Mars Explorer voice check.', lang: 'en' }, [200, 201, 204]),
];

let failed = 0;
for (const check of checks) {
  try { await check(); }
  catch (error) { failed++; console.error(String(error)); }
}
if (failed) {
  console.error(`smoke failed: ${failed}/${checks.length}`);
  process.exit(1);
}
console.log(`smoke passed: ${checks.length}/${checks.length}`);
