// Record 1920x1080 B-roll from the running app (real Chrome window → WebGL on the GPU), resampled to 30 fps JPEGs.
// Every shot: ready predicate before recording, actions on a clock, post-condition after, console-error capture,
// and a blank-frame pixel check. A failing shot is retried (×3) or the run exits non-zero.
// usage: node broll.mjs [shotId…]
import { execFileSync, spawn } from 'node:child_process';
import { linkSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url).pathname;
const BASE = 'http://localhost:3000', API = 'http://localhost:4000';
const enc = (pts) => encodeURIComponent(JSON.stringify(pts));
const WP = enc([{ lat: 18.4446, lon: 77.4509 }, { lat: 18.4526, lon: 77.4078 }, { lat: 18.4997, lon: 77.3513 }]);
const WP2 = enc([{ lat: 18.4446, lon: 77.4509 }, { lat: 18.4619, lon: 77.4361 }]);
const DELTA = enc([{ lat: 18.47, lon: 77.37 }, { lat: 18.49, lon: 77.39 }]);
const has3d = "!!document.querySelector('.data3d canvas') && !/LOADING|UNAVAILABLE/.test(document.querySelector('.data3d-stage')?.innerText||'')";
const page = "!!document.querySelector('main') && document.fonts.status === 'loaded' && [...document.images].every((i) => i.complete)";
const tiles = "document.querySelectorAll('.leaflet-tile-loaded').length >= 12";
const risk = "/\\d+\\/100/.test(document.querySelector('.risk-metric')?.innerText||'')";
const research = "/DOCS/.test(document.querySelector('.research-status')?.innerText||'') && document.querySelectorAll('.research-passages article').length >= 3";
const answered = "(document.querySelector('.rm-answer p')?.innerText||'').length > 120 && [...document.querySelectorAll('.rm-ask button')].some((b) => /RUN AGENT|ASK/.test(b.innerText) && !/WORKING|STREAMING/.test(b.innerText))";
const zoom = (n) => `(() => { for (let i = 0; i < ${Math.abs(n)}; i++) setTimeout(() => window.dispatchEvent(new CustomEvent('mars-zoom', { detail: ${Math.sign(n)} })), i * 900); return true; })()`;
const focus = (lat, lon) => `(window.dispatchEvent(new CustomEvent('mars-focus', { detail: { lat: ${lat}, lon: ${lon} } })), true)`;
const clickPath = (sel) => `(() => { const p = [...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => { const b = e.getBoundingClientRect(); return b.width > 4 && b.top > 200 && b.left > 300 && b.right < 1500; }); if (!p) return false; const b = p.getBoundingClientRect(); p.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 })); return true; })()`;
// Published delta route (sols 400–430) midpoint, so the camera can fly to it.
const track = await (await fetch(`${API}/places/perseverance?fromSol=410&toSol=430`)).json();
const MID = track.points[Math.floor(track.points.length / 2)];
const DEMO_TITLE = 'Perseverance sample caching notes';
const DEMO_BODY = 'Perseverance seals rock and regolith cores in titanium sample tubes after drilling them from carefully chosen outcrops. The mission deposited a set of these tubes on the surface at the Three Forks depot in Jezero Crater, as part of the Mars Sample Return campaign. Each tube is documented with close-up images and precise location data, so that a future mission could find and retrieve it. Other tubes remain stored inside the rover as a second, independent cache.';

const SHOTS = [
  { id: 'hero', url: '/', ready: "!!document.querySelector('.landing canvas')", settle: 2000, dur: 14 },
  { id: 'landing-terrain', url: '/', setup: [{ scroll: '.data3d' }], ready: `${has3d} && !/LOADING TILES/.test(document.querySelector('.data3d')?.innerText||'')`, settle: 2500, dur: 12 },
  { id: 'home-ask', url: '/', setup: [{ scroll: '.home-research' }, { waitFor: research }, { scroll: '.research-grid', block: 'start' }], settle: 1200, dur: 12, actions: [{ t: 0.6, click: 'RUN AGENT' }], post: answered },
  { id: 'opendata-scroll', url: '/opendata', ready: `${page} && document.querySelectorAll('.open-products article').length === 3`, settle: 1200, dur: 11, actions: [{ t: 2.5, scrollBy: 640 }, { t: 6.5, scrollBy: 520 }] },
  { id: 'research-wide', url: '/research', ready: research, settle: 1500, dur: 13, actions: [{ t: 1.0, click: 'RUN AGENT' }], post: answered },
  { id: 'orbit', url: '/timeline', setup: [{ scroll: '.data3d' }], ready: has3d, settle: 2200, dur: 12, actions: [{ t: 0.4, click: 'PLAY' }] },
  { id: 'explore-layers', url: '/explore', ready: tiles, settle: 1200, dur: 8, actions: [{ t: 0.8, clickSel: '.layer-row', index: 1 }, { t: 3.2, clickSel: '.layer-row', index: 2 }, { t: 5.6, clickSel: '.layer-row', index: 0 }] },
  { id: 'explore-sol', keep: true, ready: tiles, settle: 600, dur: 7, actions: [{ t: 0.3, scrub: "input[aria-label='Perseverance sol']", dur: 6 }] },
  { id: 'explore-names', url: '/explore', ready: `${tiles} && !!document.querySelector('.iau-label')`, settle: 1200, dur: 7, actions: [{ t: 0.5, js: zoom(3) }] },
  { id: 'explore-dtm', keep: true, settle: 600, dur: 7, actions: [{ t: 0.3, click: 'HIRISE DTM FOOTPRINTS' }, { t: 3.0, js: focus(18.47, 77.4) }], post: "document.querySelectorAll(\"path[stroke-dasharray='3 3']\").length > 3" },
  { id: 'explore-landings', keep: true, settle: 600, dur: 8, actions: [{ t: 0.3, click: 'MISSION LANDING SITES' }, { t: 0.9, click: 'GLOBAL' }, { t: 4.2, js: clickPath("path[stroke='#C45C26']") }], post: "!!document.querySelector('.detail-modal')" },
  { id: 'explore-route', url: '/explore', ready: tiles, settle: 1000, dur: 7, actions: [{ t: 0.5, click: 'LOAD PUBLISHED ROUTE' }, { t: 1.6, js: focus(MID.lat, MID.lon) }], post: `${risk} && !!document.querySelector('.terrain-profile svg')` },
  { id: 'explore-profile', keep: true, ready: "!!document.querySelector('.terrain-profile svg')", settle: 500, dur: 6, actions: [{ t: 0.4, hover: '.terrain-profile svg', dur: 5 }] },
  { id: 'explore-context', url: `/explore?wp=${DELTA}`, ready: `${tiles} && !!document.querySelector('.open-data-context')`, settle: 1200, dur: 7, actions: [{ t: 0.8, scroll: '.open-data-context', block: 'center' }, { t: 3.5, clickSel: '.open-data-context button', index: 0 }] },
  { id: 'explore-corridor', url: `/explore?wp=${WP2}`, ready: `${tiles} && ${risk}`, settle: 1200, dur: 7, actions: [{ t: 0.3, js: focus(18.4533, 77.4435) }, { t: 2.6, click: 'SUGGEST DTM CORRIDOR' }], post: "[...document.querySelectorAll('button')].some((b) => /USE SUGGESTION/.test(b.innerText))" },
  { id: 'fly', url: `/explore?view=3d&wp=${WP}`, ready: "!!document.querySelector('.terrain-3d canvas') && !/LOADING TILES/.test(document.querySelector('.terrain-credit')?.innerText||'')", settle: 2500, dur: 10, actions: [{ t: 0.4, click: 'FLY ROUTE' }] },
  { id: 'fly-wide', url: `/explore?view=3d&wp=${DELTA}`, ready: "!!document.querySelector('.terrain-3d canvas') && !/LOADING TILES/.test(document.querySelector('.terrain-credit')?.innerText||'')", settle: 2500, dur: 11, actions: [{ t: 0.4, click: 'FLY ROUTE' }] },
  { id: 'explore-assistant', url: `/explore?wp=${WP}`, ready: `${tiles} && ${risk}`, settle: 1200, dur: 7, actions: [{ t: 0.5, click: 'WHY IS THIS ROUTE SCIENTIFICALLY INTERESTING' }, { t: 3.2, scroll: '.assistant-response', block: 'start' }], post: "(document.querySelector('.assistant-response')?.innerText||'').length > 120" },
  { id: 'explore-palette', keep: true, settle: 400, dur: 5, actions: [{ t: 0.3, clickSel: "[aria-label='Open command palette']", index: 0 }, { t: 1.2, type: "input[placeholder='Search mission actions']", text: 'brief', dur: 1.0 }, { t: 4.2, key: 'Escape' }] },
  { id: 'explore-briefing', keep: true, settle: 400, dur: 6, actions: [{ t: 0.4, click: 'GENERATE BRIEFING' }], post: "/TRAVERSE RISK INDEX/.test(document.querySelector('.right-rail')?.innerText||'')" },
  { id: 'research-agent', url: '/research', ready: research, settle: 1500, dur: 13, actions: [{ t: 0.6, click: 'RUN AGENT' }], post: answered },
  { id: 'research-rag', keep: true, settle: 600, dur: 10, actions: [{ t: 0.3, click: 'ASK THE CORPUS' }, { t: 1.0, click: 'ASK' }], post: `${answered} && document.querySelectorAll('.rm-answer .cite-marker').length > 0` },
  { id: 'research-embed', keep: true, setup: [{ scroll: '.research-space', block: 'center' }], ready: "/QUERY →/.test(document.querySelector('.embedding-3d')?.innerText||'') && !!document.querySelector('.embedding-3d canvas')", settle: 1200, dur: 6 },
  { id: 'research-live', keep: true, setup: [{ scrollTop: true }, { scroll: '.research-grid', block: 'start' }], settle: 500, dur: 8, actions: [{ t: 0.3, click: 'LIVE RETRIEVAL' }, { t: 0.8, type: '.rm-ask textarea', text: 'How does Perseverance store its rock samples?', dur: 2.2 }, { t: 4.2, select: '.rp-head select', value: 'bm25' }, { t: 6.2, select: '.rp-head select', value: 'dense' }], post: "document.querySelectorAll('.research-passages article').length >= 3" },
  { id: 'research-corpus', keep: true, setup: [{ scroll: '.research-corpus', block: 'start' }], settle: 800, dur: 11, actions: [{ t: 0.5, type: ".rc-form input[placeholder='Title']", text: DEMO_TITLE, dur: 1.0 }, { t: 1.8, type: '.rc-form textarea', text: DEMO_BODY, dur: 1.8 }, { t: 4.2, click: 'INDEX TEXT', clickWhen: "[...document.querySelectorAll('.rc-form button')].some((b) => /INDEX TEXT/.test(b.innerText) && !b.disabled)" }], post: `[...document.querySelectorAll('.rc-docs a')].some((a) => a.innerText.includes(${JSON.stringify(DEMO_TITLE)}))` },
  { id: 'opendata-search', url: '/opendata', setup: [{ scroll: '#catalog', block: 'start', instant: true }], ready: "document.querySelectorAll('.theater-records article').length >= 10", settle: 1000, dur: 8, actions: [{ t: 0.5, type: '.open-search input', text: 'hirise dtm', dur: 1.2 }, { t: 4.2, type: '.open-search input', text: '', dur: 0.2 }, { t: 4.8, clickSel: '.open-facets button', index: 4 }], post: "document.querySelectorAll('.theater-records article').length >= 3" },
  { id: 'opendata-shelves', keep: true, setup: [{ scroll: '.open-landings', block: 'center' }], settle: 800, dur: 7, actions: [{ t: 1.5, clickSel: '.open-landings button', index: 7 }] },
  { id: 'opendata-dtm-detail', url: '/explore', ready: tiles, settle: 1000, dur: 10, actions: [{ t: 0.3, click: 'HIRISE DTM FOOTPRINTS' }, { t: 0.8, js: focus(18.47, 77.42) }, { t: 4.5, js: clickPath("path[stroke-dasharray='3 3']") }], post: "/HIRISE DIGITAL TERRAIN MODEL/.test(document.querySelector('.detail-modal')?.innerText||'')" },
  { id: 'eonet-feed', url: '/eonet', setup: [{ scroll: '.earth-explorer-head', block: 'start' }], ready: "document.querySelectorAll('.earth-explorer-row').length >= 5 && document.querySelectorAll('.earth-explorer-map .leaflet-tile-loaded, .earth-explorer-map .gm-style').length >= 1", settle: 1500, dur: 7, actions: [{ t: 2.0, select: '.earth-filters select', index: 1 }, { t: 5.0, select: '.earth-filters select', index: 0 }] },
  { id: 'eonet-detail', keep: true, settle: 600, dur: 6, actions: [{ t: 0.4, clickSel: '.earth-explorer-row', index: 0 }], post: "!!document.querySelector('.detail-modal')" },
  { id: 'planets', url: '/survival', setup: [{ scroll: '.data3d' }], ready: has3d, settle: 2200, dur: 5 },
  { id: 'columns', url: '/jezero', setup: [{ scroll: '.data3d' }], ready: "!!document.querySelector('.data3d canvas')", settle: 300, dur: 5 },
  { id: 'cube', url: '/mission', setup: [{ scroll: '.data3d' }], ready: has3d, settle: 2500, dur: 5 },
  { id: 'globe', url: '/data', setup: [{ scroll: '.data3d' }], ready: has3d, settle: 2200, dur: 5, actions: [{ t: 0.8, clickSel: '.sites-strip button', index: 6 }] },
  { id: 'slope', url: '/hazards', setup: [{ scroll: '.data3d' }], ready: has3d, settle: 2200, dur: 5 },
  { id: 'curtain', url: '/briefing/preview', setup: [{ scroll: '.data3d' }], ready: `${has3d} && /CURTAIN/.test(document.querySelector('.data3d')?.innerText||'')`, settle: 2500, dur: 5 },
  { id: 'traces', url: '/traces', ready: page, settle: 1200, dur: 3, actions: [{ t: 1.0, scrollBy: 320 }] },
  { id: 'architecture', url: '/architecture', setup: [{ scroll: '.dossier-scene', instant: true }], ready: "!!document.querySelector('.dossier-scene canvas')", settle: 2500, dur: 3 },
  { id: 'science', url: '/science', setup: [{ scroll: '.data3d' }], ready: has3d, settle: 2200, dur: 3 },
  { id: 'gallery', url: '/gallery', setup: [{ scrollBy: 820, instant: true }], ready: page, settle: 1500, dur: 3, actions: [{ t: 0.8, scrollBy: 300 }] },
  { id: 'compare', url: '/compare', ready: page, settle: 1200, dur: 3, actions: [{ t: 0.8, scrollBy: 300 }] },
  { id: 'analog', url: '/analog', ready: `${page} && !!document.querySelector('.scene-stage canvas')`, settle: 2000, dur: 3 },
  { id: 'story', url: '/story', ready: `${page} && !!document.querySelector('.scene-stage canvas')`, settle: 2000, dur: 3 },
  { id: 'card', url: `/route/share?wp=${WP}`, setup: [{ scroll: '.data3d' }], ready: has3d, settle: 2200, dur: 3 },
];
const wanted = process.argv.slice(2);
// A "keep" shot continues its predecessor's page state, so asking for it re-records the chain from its owner.
const pick = new Set();
for (const w of wanted) { let i = SHOTS.findIndex((s) => s.id === w); if (i < 0) throw new Error(`unknown shot ${w}`); pick.add(i); while (SHOTS[i].keep) pick.add(--i); }
const shots = wanted.length ? SHOTS.filter((_, i) => pick.has(i)) : SHOTS;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Preflight ----
const check = async (url, test, label) => { const r = await fetch(url).catch(() => null); if (!r?.ok) throw new Error(`preflight: ${label} HTTP ${r?.status}`); const body = await r.json().catch(() => null); if (test && !test(body)) throw new Error(`preflight: ${label} not ready`); };
await check(`${BASE}/`, null, 'web');
await check(`${API}/health/ready`, (b) => b.ok && !b.degraded.length, 'api ready');
await check(`${API}/rag/status`, (b) => b.semantic && b.chunks > 100, 'rag');
await check(`${API}/opendata/landings`, (b) => b.length === 9, 'opendata');
await check(`${API}/eonet/events-summary?limit=8`, (b) => Array.isArray(b) && b.length > 0, 'eonet');
console.log('preflight ok');

const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--remote-debugging-port=9337', `--user-data-dir=${dir}chrome-broll`, '--window-size=1920,1180', '--window-position=0,0', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
  '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', 'about:blank'], { stdio: 'ignore' });
const failures = [];
try {
  let target;
  for (let i = 0; i < 80 && !target; i++) { await sleep(250); try { target = (await (await fetch('http://127.0.0.1:9337/json')).json()).find((t) => t.type === 'page'); } catch {} }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0, rec = null, loaded = null, pageErrors = [];
  const pending = new Map();
  const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
    if (m.method === 'Page.loadEventFired') loaded?.();
    if (m.method === 'Runtime.exceptionThrown') pageErrors.push(m.params.exceptionDetails.exception?.description?.slice(0, 160) ?? 'exception');
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') pageErrors.push(m.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 160));
    if (m.method === 'Page.screencastFrame') {
      send('Page.screencastFrameAck', { sessionId: m.params.sessionId });
      if (rec) { const name = `r_${String(rec.n++).padStart(5, '0')}.jpg`; writeFileSync(`${rec.dir}/${name}`, Buffer.from(m.params.data, 'base64')); rec.frames.push({ name, t: m.params.metadata.timestamp }); }
    }
  });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.setDownloadBehavior', { behavior: 'deny' });
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='nextjs-portal{display:none!important}';document.documentElement.appendChild(s)})" });
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }))?.result?.value;
  const navigate = async (path) => { const p = new Promise((r) => { loaded = r; }); await send('Page.navigate', { url: BASE + path }); await Promise.race([p, sleep(12000)]); };
  const waitFor = async (expr, ms = 45000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await evaluate(`(() => { try { return Boolean(${expr}); } catch { return false; } })()`)) return true; await sleep(300); } return false; };
  const runInPage = (a) => evaluate(
    a.js ? a.js
    : a.scrollTop ? `(window.scrollTo({top:0,behavior:'instant'}), true)`
    : a.clickSel ? `(() => { const el = document.querySelectorAll(${JSON.stringify(a.clickSel)})[${a.index ?? 0}]; el?.click(); return !!el; })()`
    : a.type ? `(() => { const el = document.querySelector(${JSON.stringify(a.type)}); if (!el) return false; const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; const set = Object.getOwnPropertyDescriptor(proto, 'value').set; const text = ${JSON.stringify(a.text ?? '')}; el.focus(); let i = 0; const step = Math.max(1, Math.ceil(text.length / (${a.dur ?? 1} * 30))); const tick = () => { i = Math.min(text.length, i + step); set.call(el, text.slice(0, i)); el.dispatchEvent(new Event('input', { bubbles: true })); if (i < text.length) setTimeout(tick, 33); }; set.call(el, ''); el.dispatchEvent(new Event('input', { bubbles: true })); if (text) tick(); return true; })()`
    : a.select ? `(() => { const el = document.querySelector(${JSON.stringify(a.select)}); if (!el) return false; const v = ${a.value != null ? JSON.stringify(a.value) : `el.options[${a.index ?? 0}]?.value`}; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`
    : a.scroll ? `(() => { const el = document.querySelector(${JSON.stringify(a.scroll)}); el?.scrollIntoView({behavior:${a.instant ? "'instant'" : "'smooth'"},block:${JSON.stringify(a.block ?? 'center')}}); return !!el; })()`
    : a.scrollBy ? `(window.scrollBy({top:${a.scrollBy},behavior:${a.instant ? "'instant'" : "'smooth'"}}), true)`
    : a.click ? `(() => { const w=${JSON.stringify(a.click)}; const els=[...document.querySelectorAll('button,a')].filter(e=>e.offsetParent!==null); const n=(e)=>e.innerText.replace(/[“”↗▶]/g,'').trim().toUpperCase(); const hit=(els.find(e=>n(e)===w)||els.find(e=>n(e).includes(w))); hit?.click(); return !!hit; })()`
    : `(() => { const el=document.querySelector(${JSON.stringify(a.scrub)}); if(!el) return false; const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; const to=Number(el.max), t0=performance.now(), d=${(a.dur ?? 5) * 1000}; const step=(now)=>{const f=Math.min(1,(now-t0)/d); set.call(el,String(Math.round(to*f))); el.dispatchEvent(new Event('input',{bubbles:true})); if(f<1) requestAnimationFrame(step);}; requestAnimationFrame(step); return true; })()`);
  const run = async (a) => {
    if (a.clickWhen) { if (!(await waitFor(a.clickWhen, 6000))) return false; return runInPage({ click: a.click }); }
    if (a.key) { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: a.key, code: a.key, windowsVirtualKeyCode: a.key === 'Escape' ? 27 : 0 }); return true; }
    if (a.hover) {
      const r = await evaluate(`(() => { const b = document.querySelector(${JSON.stringify(a.hover)})?.getBoundingClientRect(); return b ? [b.left, b.top, b.width, b.height] : null; })()`);
      if (!r) return false;
      const steps = Math.round((a.dur ?? 5) * 30);
      for (let k = 0; k <= steps; k++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r[0] + r[2] * (0.03 + 0.94 * (k / steps)), y: r[1] + r[3] * 0.45 }); await sleep(1000 / 30); }
      return true;
    }
    return runInPage(a);
  };

  await navigate('/');
  await evaluate("localStorage.setItem('me_onboarded','1'); sessionStorage.removeItem('mars-tour-step')");
  // Warm compiles, tiles and caches; fail fast on any page that throws.
  for (const s of shots.filter((x) => x.url)) {
    pageErrors = [];
    await navigate(s.url); await sleep(2000);
    await evaluate("document.querySelector('.data3d')?.scrollIntoView({block:'center'})"); await sleep(2000);
    if (pageErrors.length) throw new Error(`warmup: ${s.url} has console errors: ${pageErrors[0]}`);
  }
  await send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });

  const recordShot = async (s) => {
    pageErrors = [];
    if (s.url) { await navigate(s.url); await sleep(1000); }
    for (const a of s.setup ?? []) { if (a.waitFor) { if (!(await waitFor(a.waitFor))) return `setup wait failed: ${a.waitFor.slice(0, 60)}`; } else await run(a); await sleep(500); }
    if (s.ready && !(await waitFor(s.ready))) return 'not ready (blank/loading state)';
    await sleep(s.settle);
    const out = `${dir}clips/${s.id}`;
    rmSync(out, { recursive: true, force: true });
    mkdirSync(`${out}/raw`, { recursive: true });
    rec = { dir: `${out}/raw`, n: 0, frames: [] };
    const t0 = Date.now() / 1000;
    const results = await Promise.all([sleep(s.dur * 1000), ...(s.actions ?? []).map((a) => sleep(a.t * 1000).then(() => run(a)))]);
    const { frames } = rec; rec = null;
    if (results.slice(1).some((r) => r === false)) return `an action target was missing (${(s.actions ?? []).filter((_, i) => results[i + 1] === false).map((a) => a.click ?? a.clickSel ?? a.type ?? a.js?.slice(0, 40)).join(', ')})`;
    if (s.post && !(await waitFor(s.post, 5000))) return 'post-condition failed (feature did not complete on camera)';
    if (pageErrors.length) return `console error: ${pageErrors[0]}`;
    if (frames.length < 2) return 'no frames captured';
    let j = 0;
    const n = Math.round(s.dur * 30);
    for (let k = 0; k < n; k++) {
      const t = t0 + k / 30;
      while (j + 1 < frames.length && frames[j + 1].t <= t) j++;
      linkSync(`${out}/raw/${frames[j].name}`, `${out}/f_${String(k).padStart(5, '0')}.jpg`);
    }
    for (let q = 0; q < 4; q++) {
      const f = `${out}/f_${String(Math.floor(((q + 0.5) / 4) * n)).padStart(5, '0')}.jpg`;
      const stats = execFileSync('ffmpeg', ['-hide_banner', '-i', f, '-vf', 'signalstats,metadata=print:file=-', '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
      // Min/max, not 10th/90th percentile: a dark page with small text is mostly background but not blank.
      const lo = Number(/YMIN=([\d.]+)/.exec(stats)?.[1] ?? 0), hi = Number(/YMAX=([\d.]+)/.exec(stats)?.[1] ?? 0);
      if (hi - lo < 40) return `blank frame detected (luma range ${hi - lo})`;
    }
    return `${frames.length} raw frames → ${n} @30fps`;
  };

  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    let result;
    for (let attempt = 1; attempt <= 3; attempt++) {
      result = await recordShot(s);
      if (/@30fps$/.test(result)) break;
      console.log(`${s.id}: attempt ${attempt} failed — ${result}`);
      if (s.keep) { let k = i; while (k > 0 && shots[k].keep) k--; for (let r = k; r < i; r++) await recordShot(shots[r]); }
    }
    console.log(`${s.id}: ${result}`);
    if (!/@30fps$/.test(result)) failures.push(`${s.id}: ${result}`);
  }
  await send('Page.stopScreencast');
  ws.close();
} finally { chrome.kill(); }
// Remove the corpus document indexed on camera.
const docs = await (await fetch(`${API}/rag/documents`)).json().catch(() => []);
for (const d of docs.filter((x) => x.source === 'user' && x.title === DEMO_TITLE)) { await fetch(`${API}/rag/documents/${d.id}`, { method: 'DELETE' }); console.log(`removed demo doc ${d.id}`); }
if (failures.length) { console.log('FAILED SHOTS:\n' + failures.join('\n')); process.exit(1); }
console.log('all shots verified');
