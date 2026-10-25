#!/usr/bin/env node
/**
 * Browser smoke: open every page in headless Chrome over CDP, wait for its ready selector, fail on console errors,
 * uncaught exceptions or a near-empty page, and save a screenshot per page.
 * Usage: WEB_URL=http://localhost:3000 CHROME=/path/to/chrome OUT=smoke-shots node scripts/smoke-pages.mjs [page-filter]
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.env.WEB_URL || 'http://localhost:3000';
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const out = process.env.OUT || join(tmpdir(), 'mars-explorer-smoke');
const port = 9333 + Math.floor(Math.random() * 500);
const route = encodeURIComponent(JSON.stringify([{ lat: 18.4447, lon: 77.4508 }, { lat: 18.4619, lon: 77.4361 }]));

// [path, selector that proves the page's main feature rendered]
const PAGES = [
  ['/', 'main'], ['/survival', '.comm-calendar'], ['/timeline', '.comm-calendar svg path'], ['/mission', 'main'], ['/jezero', 'main'],
  ['/eonet', 'main'], ['/explore?wp=' + route, '.survival-card'], ['/classroom', 'main'], ['/targets', 'main'], ['/hazards', 'main'],
  ['/ops', 'main'], ['/traces', 'main'], ['/research', 'main'], ['/briefing/preview', 'main'], ['/pipeline', 'main'],
  ['/architecture', 'main'], ['/story', 'main'], ['/game', '.sol-game'], ['/opendata', 'main'], ['/science', 'main'], ['/data', 'main'],
  ['/gallery', 'main'], ['/analog', 'main'], ['/compare', 'main'], ['/validation', '.validation-page'],
];
// Known benign noise: Google Maps rejects unlisted referrers and the app falls back to OSM tiles.
// Trek answers tiles outside a mosaic's footprint with an error that has no CORS header; the CTX layer underneath covers them.
const BENIGN = [/RefererNotAllowedMapError|Google Maps JavaScript API/i, /Download the React DevTools/i, /favicon\.ico/, /trek\.nasa\.gov\/tiles\/Mars\/EQ\/JEZ_hirise/];

const filter = process.argv[2];
const pages = PAGES.filter(([p]) => !filter || p.includes(filter));
mkdirSync(out, { recursive: true });

const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'me-chrome-'))}`, '--window-size=1440,900', '--no-first-run', '--use-gl=angle', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map(), listeners = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } else listeners.forEach((l) => l(msg));
  };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  return { send, on: (l) => listeners.push(l), close: () => ws.close() };
}

async function check([path, selector]) {
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const c = await cdp(target.webSocketDebuggerUrl);
  const errors = [];
  c.on((m) => {
    const text = m.method === 'Runtime.exceptionThrown' ? m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text
      : m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error' ? m.params.args.map((a) => a.value ?? a.description ?? '').join(' ')
      : m.method === 'Log.entryAdded' && m.params.entry.level === 'error' ? `${m.params.entry.text} ${m.params.entry.url ?? ''}` : null;
    if (text && !BENIGN.some((re) => re.test(text))) errors.push(text.slice(0, 300));
  });
  await Promise.all(['Runtime.enable', 'Log.enable', 'Page.enable'].map((m) => c.send(m)));
  await c.send('Page.addScriptToEvaluateOnNewDocument', { source: "try { localStorage.setItem('me_onboarded', '1'); } catch {}" });
  await c.send('Page.navigate', { url: base + path });
  let found = false;
  for (let i = 0; i < 20 && !found; i++) {
    await sleep(500);
    found = (await c.send('Runtime.evaluate', { expression: `!!document.querySelector(${JSON.stringify(selector)})`, returnByValue: true })).result?.result?.value === true;
  }
  const ev = async (expression) => (await c.send('Runtime.evaluate', { expression, returnByValue: true })).result?.result?.value;
  // Every lazily mounted 3D section must reach a WebGL canvas (or an honest "unavailable" state), not stay "LOADING".
  const scenes = await ev("document.querySelectorAll('.data3d-stage').length") ?? 0;
  const stuck = [];
  for (let s = 0; s < scenes; s++) {
    const stage = `document.querySelectorAll('.data3d-stage')[${s}]`;
    await ev(`${stage}.scrollIntoView({ block: 'center' })`);
    let state = 'LOADING';
    for (let k = 0; k < 60 && state === 'LOADING'; k++) {
      await sleep(500);
      state = await ev(`(() => { const e = ${stage}; if (!e) return 'GONE'; if (e.querySelector('canvas')) return 'CANVAS'; return /LOADING|BUILDING|JEZERO · 3D/.test(e.innerText) ? 'LOADING' : 'MESSAGE'; })()`);
    }
    if (state !== 'CANVAS') stuck.push(`3D section ${s + 1}/${scenes} ${state === 'LOADING' ? 'never rendered' : `shows: ${(await ev(`${stage}?.innerText`) ?? '').slice(0, 80)}`}`);
    if (state === 'CANVAS') {
      await sleep(1500);
      const r = await ev(`(() => { const b = ${stage}.getBoundingClientRect(); return { x: b.x + scrollX, y: b.y + scrollY, width: b.width, height: b.height }; })()`);
      const shot = await c.send('Page.captureScreenshot', { format: 'jpeg', quality: 70, clip: { ...r, scale: 0.6 } });
      if (shot.result?.data) writeFileSync(join(out, `${path.split('?')[0].replace(/\//g, '_') || '_home'}-3d${s + 1}.jpg`), Buffer.from(shot.result.data, 'base64'));
    }
  }
  if (selector !== 'main') await c.send('Runtime.evaluate', { expression: `document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({ block: 'center' })` });
  await sleep(1200); // let 3D scenes and data panels settle before the screenshot
  const textLen = (await c.send('Runtime.evaluate', { expression: 'document.body.innerText.trim().length', returnByValue: true })).result?.result?.value ?? 0;
  const shot = await c.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
  const file = join(out, `${path.split('?')[0].replace(/\//g, '_') || '_home'}.jpg`);
  if (shot.result?.data) writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
  c.close();
  await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`);
  const problems = [...(found ? [] : [`ready selector ${selector} never appeared`]), ...(textLen < 80 ? [`page text only ${textLen} chars`] : []), ...stuck, ...errors];
  process.stdout.write(`${problems.length ? 'FAIL' : 'OK  '} ${path.split('?')[0]}${scenes ? ` · ${scenes - stuck.length}/${scenes} 3D` : ''}${problems.length ? `\n     ${problems.join('\n     ')}` : ''}\n`);
  return problems.length === 0;
}

let failed = 0;
try {
  for (let i = 0; i < 40; i++) { try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch { await sleep(250); } }
  for (const page of pages) if (!(await check(page))) failed++;
} finally { proc.kill(); }
console.log(`${pages.length - failed}/${pages.length} pages passed · screenshots in ${out}`);
process.exit(failed ? 1 : 0);
