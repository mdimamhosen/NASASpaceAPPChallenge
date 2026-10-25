#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.env.WEB_URL || 'http://localhost:3000';
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9800 + Math.floor(Math.random() * 200);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const browser = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'me-game-'))}`, '--window-size=1360,900', '--no-first-run', '--use-gl=angle', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
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
  c = await connect(target.webSocketDebuggerUrl);
  const errors = [];
  c.on((m) => { const msg = m.method === 'Runtime.exceptionThrown' ? m.params.exceptionDetails.text : m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error' ? m.params.args.map((a) => a.value ?? a.description ?? '').join(' ') : null; if (msg) errors.push(msg.slice(0, 240)); });
  await Promise.all(['Runtime.enable', 'Page.enable'].map((method) => c.send(method)));
  await c.send('Page.addScriptToEvaluateOnNewDocument', { source: "localStorage.removeItem('me_sol_contract_run_v1'); localStorage.removeItem('me_sol_contract_board_v1'); localStorage.setItem('me_lang','en');" });
  await c.send('Page.navigate', { url: `${base}/game` });
  const ev = async (expression) => (await c.send('Runtime.evaluate', { expression, returnByValue: true })).result?.result?.value;
  const until = async (expression, label) => { for (let i = 0; i < 120; i++) { if (await ev(expression)) return; await pause(250); } const state = await ev("JSON.stringify({ cards:document.querySelectorAll('.sol-contract-card').length,buttons:[...document.querySelectorAll('.sol-contract-card button')].map((b)=>({text:b.textContent,disabled:b.disabled})),body:document.body.innerText.slice(0,500) })"); throw new Error(`Timed out waiting for ${label}: ${state}`); };
  await until("!!document.querySelector('.sol-contract-card button:not(:disabled)')", 'published route contracts');
  if (!(await ev("!!document.querySelector('.mission-nav nav a[href=\"/game\"]')"))) throw new Error('/game is missing from the mission navigation');
  await ev("document.querySelector('.sol-contract-card button:not(:disabled)').click()");
  await until("!!document.querySelector('.sol-primary') && document.querySelector('.sol-primary').textContent.includes('ANALYZE')", 'route planner');
  await ev("document.querySelector('.sol-primary').click()");
  await until("!!document.querySelector('.sol-debrief header h2')", 'first contract debrief');
  const first = await ev("document.querySelector('.sol-debrief header h2').textContent");
  if (!first.includes('COMPLETE')) throw new Error(`Expected first contract to pass, saw: ${first}`);
  await ev("document.querySelector('.sol-primary').click()");
  await until("!!document.querySelector('.sol-contract-card button:not(:disabled)')", 'next contract');
  await ev("document.querySelectorAll('.sol-contract-card button:not(:disabled)')[1].click()");
  await until("!!document.querySelector('.sol-primary') && document.querySelector('.sol-primary').textContent.includes('ANALYZE')", 'second route planner');
  await ev("document.querySelector('.sol-detour input').click()");
  await ev("document.querySelector('.sol-primary').click()");
  await until("!!document.querySelector('.sol-debrief header h2')", 'long-range contract debrief');
  const second = await ev("document.querySelector('.sol-debrief header h2').textContent");
  if (!second.includes('REVISION')) throw new Error(`Expected long-range contract to fail, saw: ${second}`);
  const video = await (await fetch(`${base}/video/mars-explorer-240s.mp4`)).status;
  if (video !== 200) throw new Error(`Local walkthrough video returned HTTP ${video}`);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`PASS /game: first contract ${first}; detour contract ${second}; local video HTTP ${video}`);
} catch (error) {
  console.error(`FAIL /game: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally { c?.close(); browser.kill(); }
