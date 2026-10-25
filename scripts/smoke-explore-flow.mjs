#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.env.WEB_URL || 'http://localhost:3000';
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 10000 + Math.floor(Math.random() * 300);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const browser = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'me-explore-'))}`, '--window-size=1440,1000', '--no-first-run', '--use-gl=angle', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
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
  c.on((m) => { const msg = m.method === 'Runtime.exceptionThrown' ? m.params.exceptionDetails.text : m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error' ? m.params.args.map((a) => a.value ?? a.description ?? '').join(' ') : null; if (msg) errors.push(msg.slice(0, 240)); });
  await Promise.all(['Runtime.enable', 'Page.enable'].map((method) => c.send(method)));
  await c.send('Page.addScriptToEvaluateOnNewDocument', { source: "localStorage.setItem('me_onboarded','1'); localStorage.setItem('me_lang','en'); const originalCreateObjectURL=URL.createObjectURL.bind(URL); URL.createObjectURL=(...args)=>{const url=originalCreateObjectURL(...args);window.__marsBlobs=[...(window.__marsBlobs||[]),url];return url};" });
  await c.send('Page.navigate', { url: `${base}/explore` });
  const ev = async (expression) => (await c.send('Runtime.evaluate', { expression, returnByValue: true })).result?.result?.value;
  const until = async (expression, label) => { for (let i = 0; i < 100; i++) { if (await ev(expression)) return; await pause(300); } const state = await ev("JSON.stringify({cockpit:document.querySelector('.evidence-cockpit')?.innerText.slice(0,500), route:document.querySelector('.route-actions')?.innerText.slice(0,300), errors:[...document.querySelectorAll('[role=alert]')].map((e)=>e.innerText)})"); throw new Error(`Timed out waiting for ${label}: ${state}`); };
  await until("!!document.querySelector('.preset-list button')", 'route presets');
  await until("/SOL \\d+ · \\d+\\.\\d+/.test(document.querySelector('.places-controls p')?.textContent ?? '')", 'published PLACES points');
  await ev("[...document.querySelectorAll('.preset-list button')].find((b) => b.textContent.includes('Short EVA')).click()");
  await until("document.querySelector('.evidence-cockpit')?.textContent.includes('NON-CERTIFYING') && /RISK \\d+\\/100/.test(document.querySelector('.evidence-cockpit').textContent)", 'numeric non-certifying risk analysis');
  await ev("document.querySelector('.route-actions button') && [...document.querySelectorAll('.route-actions button')].find((b) => b.textContent.includes('GEOJSON')).click()");
  const blobCreated = await ev("(window.__marsBlobs||[]).some((url)=>url.startsWith('blob:'))");
  if (!blobCreated) throw new Error('GeoJSON export did not create a blob download URL');
  await ev("[...document.querySelectorAll('.right-tabs button')].find((b) => b.textContent.includes('BRIEFING')).click()");
  await until("!!document.querySelector('.empty-briefing button')", 'briefing action');
  await ev("document.querySelector('.empty-briefing button').click()");
  await until("!!document.querySelector('.briefing-title h2')", 'generated briefing');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('PASS /explore: Short EVA → numeric risk → GeoJSON blob → generated briefing');
} catch (error) {
  console.error(`FAIL /explore flow: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally { c?.close(); browser.kill(); }
