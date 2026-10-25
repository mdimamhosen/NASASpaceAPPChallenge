#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.env.WEB_URL || 'http://localhost:3000';
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 10300 + Math.floor(Math.random() * 300);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const browser = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'me-voice-ui-'))}`, '--window-size=1360,900', '--no-first-run', '--use-gl=angle', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
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
  const source = "localStorage.setItem('me_lang','en'); Object.defineProperty(window,'__speechProbe',{value:{pending:null,cancelled:false}}); class TestUtterance{constructor(text){this.text=text;this.lang='en-US';this.rate=1}} Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:TestUtterance}); Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{speaking:false,getVoices:()=>[{lang:'en-US',name:'Test'}],cancel(){this.speaking=false;window.__speechProbe.pending=null;window.__speechProbe.cancelled=true},speak(u){this.speaking=true;window.__speechProbe.pending=u}}});";
  await c.send('Page.addScriptToEvaluateOnNewDocument', { source });
  await c.send('Page.navigate', { url: `${base}/` });
  const ev = async (expression) => (await c.send('Runtime.evaluate', { expression, returnByValue: true })).result?.result?.value;
  const typeAndSubmit = (text) => `${input}.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(${input},${JSON.stringify(text)});${input}.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:${JSON.stringify(text)}}));document.querySelector('.voice-globe-pop form').requestSubmit()`;
  const until = async (expression, label) => { for (let i = 0; i < 80; i++) { if (await ev(expression)) return; await pause(250); } throw new Error(`Timed out waiting for ${label}`); };
  await until("!!document.querySelector('.voice-globe-orb')", 'voice orb');
  await ev("document.querySelector('.voice-globe-orb').click()");
  await until("[...document.querySelectorAll('.voice-globe-pop button')].some((b)=>b.textContent==='TURN ON')", 'voice controls');
  await ev("[...document.querySelectorAll('.voice-globe-pop button')].find((b)=>b.textContent==='TURN ON').click()");
  await ev("document.querySelector('.voice-globe-more').click()");
  await until("!!document.querySelector('.voice-globe-pop input')", 'voice command box after audio unlock');
  const input = "document.querySelector('.voice-globe-pop input')";
  await ev(typeAndSubmit('go explore'));
  await until("location.pathname==='/explore'", 'voice navigation to Explore');
  await until("!!document.querySelector('.voice-globe-pop input')", 'voice command box');
  await ev(typeAndSubmit('help'));
  try { await until("document.querySelector('.voice-globe-orb').classList.contains('voice-speaking') && window.__speechProbe.pending", 'active spoken response'); }
  catch (error) { const state = await ev("JSON.stringify({orb:document.querySelector('.voice-globe-orb')?.className,caption:document.querySelector('.voice-globe-caption')?.innerText,probe:window.__speechProbe,form:!!document.querySelector('.voice-globe-pop input')})"); throw new Error(`${error.message}: ${state}`); }
  await ev(typeAndSubmit('stop'));
  await until("!document.querySelector('.voice-globe-orb').classList.contains('voice-speaking') && window.__speechProbe.cancelled && !window.__speechProbe.pending", 'speech cancellation');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('PASS voice UI: turn on → go explore → spoken help → stop cancels active speech');
} catch (error) {
  console.error(`FAIL voice UI: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally { c?.close(); browser.kill(); }
