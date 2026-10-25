#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.env.WEB_URL || 'http://localhost:3000';
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 10600 + Math.floor(Math.random() * 250);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const BENIGN = [/RefererNotAllowedMapError|Google Maps JavaScript API/i, /Download the React DevTools/i, /favicon\.ico/, /trek\.nasa\.gov\/tiles\/Mars\/EQ\/JEZ_hirise/];
const browser = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'me-ui-details-'))}`, '--window-size=1440,1000', '--no-first-run', '--use-gl=angle', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
async function connect(url) {
  const ws = new WebSocket(url); await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0; const pending = new Map(), listeners = [];
  ws.onmessage = (e) => { const msg = JSON.parse(e.data); if (pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } else listeners.forEach((listener) => listener(msg)); };
  return { send: (method, params = {}) => new Promise((resolve) => { const next = ++id; pending.set(next, resolve); ws.send(JSON.stringify({ id: next, method, params })); }), on: (fn) => listeners.push(fn), close: () => ws.close() };
}
let c;
try {
  for (let i = 0; i < 80; i++) { try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch { await pause(250); } }
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  c = await connect(target.webSocketDebuggerUrl); const errors = [];
  c.on((m) => { const msg = m.method === 'Runtime.exceptionThrown' ? m.params.exceptionDetails.text : m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error' ? m.params.args.map((a) => a.value ?? a.description ?? '').join(' ') : null; if (msg && !BENIGN.some((re) => re.test(msg))) errors.push(msg.slice(0, 240)); });
  await Promise.all(['Runtime.enable', 'Log.enable', 'Page.enable'].map((method) => c.send(method)));
  await c.send('Page.addScriptToEvaluateOnNewDocument', { source: "localStorage.setItem('me_onboarded','1');localStorage.setItem('me_lang','en');" });
  const ev = async (expression) => (await c.send('Runtime.evaluate', { expression, returnByValue: true })).result?.result?.value;
  const until = async (expression, label) => { for (let i = 0; i < 120; i++) { if (await ev(expression)) return; await pause(250); } const state = await ev("JSON.stringify({lang:localStorage.getItem('me_lang'),links:[...document.querySelectorAll('.mission-nav nav a')].slice(0,6).map((a)=>[a.href,a.textContent]),buttons:[...document.querySelectorAll('.mission-lang-toggle')].map((b)=>b.textContent)})"); throw new Error(`Timed out waiting for ${label}: ${state}`); };
  const goto = async (path, selector, label = path) => { await c.send('Page.navigate', { url: `${base}${path}` }); await until(`!!document.querySelector(${JSON.stringify(selector)})`, label); };
  const clickAt = async (selector) => { const point = await ev(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`); await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point}); await c.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1}); await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1}); };
  await goto('/', '.walkthrough-video video', 'landing video player');
  if (await ev("document.querySelector('.walkthrough-video video').getAttribute('src')") !== '/video/mars-explorer-240s.mp4') throw new Error('Landing video does not use the local 240 second file');
  if (await ev("document.querySelector('.walkthrough-video video').getAttribute('controls') !== null") !== true) throw new Error('Landing walkthrough video is missing native controls');
  console.log('PASS landing: local MP4 walkthrough with controls');
  await until("Object.keys(document.querySelector('.mission-lang-toggle')||{}).some((key)=>key.startsWith('__reactProps$'))", 'navbar language control hydration');
  const clickLanguageToggle = async () => clickAt('.mission-lang-toggle');
  await clickLanguageToggle();
  await until("document.querySelector('.mission-nav nav a[href=\"/game\"]')?.textContent.includes('সোল কনট্র্যাক্ট')", 'Bangla navbar labels');
  await clickLanguageToggle();
  await until("document.querySelector('.mission-nav nav a[href=\"/game\"]')?.textContent.includes('SOL CONTRACT')", 'English navbar labels');
  console.log('PASS language: navbar toggles English ↔ Bangla');
  await goto('/survival', '.comm-calendar', 'survival comms calendar');
  if (!(await ev("document.querySelector('.mission-nav-tour')?.getAttribute('href') === '/survival'"))) throw new Error('Demo tour link does not lead to /survival');
  console.log('PASS demo tour: navigation lands on /survival with calendar');
  await goto('/explore', '.icon-tool[title="Center on Gale (Curiosity)"]', 'Gale map control');
  await until("Object.keys(document.querySelector('.icon-tool[title=\"Center on Gale (Curiosity)\"]')||{}).some((key)=>key.startsWith('__reactProps$'))", 'Gale control hydration');
  await clickAt('.icon-tool[title="Center on Gale (Curiosity)"]');
  try { await until("document.querySelector('.header-location')?.textContent.includes('GALE CRATER') && document.querySelector('.location-title h1')?.textContent.includes('Gale') && document.querySelector('.location-title p')?.textContent.includes('-4.59')", 'Gale region recenter and center coordinates'); }
  catch (e) { const state = await ev("JSON.stringify({header:document.querySelector('.header-location')?.innerText,title:document.querySelector('.location-title')?.innerText,api:performance.getEntriesByType('resource').filter((x)=>x.name.includes('/regions/gale')).map((x)=>x.name)})"); throw new Error(`${e.message}: ${state}`); }
  console.log('PASS Explore: Gale recenter updates active region and coordinates');
  await goto('/research', '.rm-cloud input', 'research cloud control');
  if (await ev("document.querySelector('.rm-cloud input').checked")) throw new Error('Research cloud model is not off by default');
  console.log('PASS Research: cloud model is opt-in and off by default');
  await goto('/opendata', '[aria-label="Catalog source"]', 'Open Data source controls');
  if (!(await ev("document.querySelector('[aria-label=\"Catalog source\"] button.active')?.textContent.includes('LIVE DATA.NASA.GOV')"))) throw new Error('Open Data does not default to the live catalog');
  console.log('PASS Open Data: live catalog selected by default');
  await goto('/eonet', '.earth-explorer-map', 'EONET Earth map');
  await pause(1200);
  if (await ev("!!document.querySelector('.mars-map, .map-frame, img[src*=\"Mars\"]')")) throw new Error('EONET page rendered a Mars Trek surface map');
  if (!(await ev("document.querySelector('.earth-explorer-map')?.innerText.includes('EARTH COORDINATES')"))) throw new Error('EONET map is missing its Earth label');
  console.log('PASS EONET: Earth map is labeled and contains no Mars Trek canvas or tile');
  await goto('/validation', '.vd-table tbody tr', 'validation report rows');
  console.log('PASS validation: live science report rows are visible');
  if (errors.length) throw new Error(`unexpected browser console errors: ${errors.join(' | ')}`);
} catch (error) {
  console.error(`FAIL UI details: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally { c?.close(); browser.kill(); }
