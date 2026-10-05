#!/usr/bin/env node
// Ingest curated public NASA pages into the RAG corpus through the running API (pnpm dev first).
// Usage: pnpm ingest:corpus   (env: API_URL, RAG_ADMIN_TOKEN)
const API = process.env.API_URL || 'http://localhost:4000';
const URLS = [
  'https://science.nasa.gov/mission/mars-2020-perseverance/',
  'https://science.nasa.gov/mission/mars-2020-perseverance/science/',
  'https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/',
  'https://science.nasa.gov/mission/mars-2020-perseverance/science-instruments/',
  'https://science.nasa.gov/mission/mars-2020-perseverance/mars-rock-samples/',
  'https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/',
  'https://science.nasa.gov/mars/facts/',
  'https://science.nasa.gov/mission/mars-reconnaissance-orbiter/',
  'https://science.nasa.gov/mission/msl-curiosity/',
  'https://science.nasa.gov/mission/insight/',
  'https://science.nasa.gov/mission/viking-1/',
  'https://pds-geosciences.wustl.edu/missions/mars2020/places.htm',
  'https://pds-geosciences.wustl.edu/missions/mars2020/index.htm',
  ['https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars', 'NASA Mars Trek API (WMTS tile service)'],
  ['https://eonet.gsfc.nasa.gov/docs/v3', 'NASA EONET v3 API documentation (Earth only)'],
  ['https://eonet.gsfc.nasa.gov/what-is-eonet', 'What is NASA EONET (Earth only)'],
  'https://ssd.jpl.nasa.gov/planets/approx_pos.html',
  'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html',
  'https://nssdc.gsfc.nasa.gov/planetary/factsheet/',
  'https://nssdc.gsfc.nasa.gov/planetary/planets/marspage.html',
  'https://www.uahirise.org/epo/about/',
];

const headers = { 'content-type': 'application/json', ...(process.env.RAG_ADMIN_TOKEN ? { 'x-rag-token': process.env.RAG_ADMIN_TOKEN } : {}) };
let ok = 0;
for (const entry of URLS) {
  const [url, title] = Array.isArray(entry) ? entry : [entry];
  const started = Date.now();
  try {
    const res = await fetch(`${API}/rag/documents/url`, { method: 'POST', headers, body: JSON.stringify({ url, source: 'curated', ...(title ? { title } : {}) }) });
    const body = await res.json();
    if (!res.ok) throw new Error(Array.isArray(body.message) ? body.message.join('; ') : body.message);
    ok++;
    console.log(`✓ ${body.title} — ${body.chunks} chunks, ${body.words} words (${Date.now() - started} ms)`);
  } catch (error) {
    console.log(`✗ ${url} — ${error.message}`);
  }
}
const status = await (await fetch(`${API}/rag/status`)).json();
console.log(`\n${ok}/${URLS.length} ingested · corpus: ${status.documents} documents, ${status.chunks} chunks, semantic=${status.semantic}`);
