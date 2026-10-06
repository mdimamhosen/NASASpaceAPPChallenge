// usage: node render.mjs timeline | stills 1,30,90 | full [from-to]
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url).pathname;
const [mode = 'timeline', arg] = process.argv.slice(2);
const script = JSON.parse(readFileSync(`${dir}script.json`, 'utf8'));
const vo = JSON.parse(readFileSync(`${dir}vo/durations.json`, 'utf8'));
const FPS = 30, TOTAL = script.duration;

// ---- Timeline: scene = lead + voice + tail. Chapter openers get a longer lead (title card plays before the voice);
// every tail shares the remaining slack so the sum is exactly TOTAL. ----
const HOOK_LEAD = 2.2, LEAD = 0.5, CHAPTER_LEAD = 1.5, CLOSE_TAIL = 2.6;
const S = script.scenes, n = S.length;
const opens = (s, i) => i > 0 && s.chapter !== S[i - 1].chapter;
const leadOf = (s, i) => (i === 0 ? HOOK_LEAD : opens(s, i) ? CHAPTER_LEAD : LEAD);
const voSum = S.reduce((a, s) => a + vo[s.id], 0);
const leads = S.reduce((a, s, i) => a + leadOf(s, i), 0);
const tail = (TOTAL - voSum - leads - CLOSE_TAIL) / (n - 1);
if (tail < 0.15) throw new Error(`voice too long: tail ${tail.toFixed(2)} s`);
const clips = Object.fromEntries((existsSync(`${dir}clips`) ? readdirSync(`${dir}clips`) : []).filter((id) => existsSync(`${dir}clips/${id}/f_00000.jpg`)).map((id) => [id, { frames: readdirSync(`${dir}clips/${id}`).filter((f) => f.startsWith('f_')).length, clicks: existsSync(`${dir}clips/${id}/clicks.json`) ? JSON.parse(readFileSync(`${dir}clips/${id}/clicks.json`, 'utf8')) : [] }]));
const frac = (text, needle) => { const i = text.indexOf(needle); if (i < 0) throw new Error(`cue "${needle}" not in VO`); return i / text.length; };
let t = 0;
const scenes = S.map((s, index) => {
  const lead = leadOf(s, index);
  const dur = lead + vo[s.id] + (index === n - 1 ? CLOSE_TAIL : tail);
  const start = t; t += dur;
  const voStart = start + lead, voDur = vo[s.id], end = start + dur;
  const out = { ...s, index, start, dur, end, voStart, voDur, cues: {}, clips: s.clips ?? [] };
  // Each clip plays in an equal slot; speed fits the recorded length to the slot (slow-mo or fast-forward, bounded).
  // Grid scenes show cols*rows clips at once, so each clip's slot is a page, not dur / clips.
  const seg = s.kind === 'grid' ? dur / Math.ceil(out.clips.length / (s.cols * s.rows)) : dur / Math.max(1, out.clips.length);
  out.speeds = out.clips.map((c) => (clips[c] ? clamp(clips[c].frames / FPS / seg, 0.45, 2.2) : 1));
  out.cues.keywords = (s.keywords ?? []).map((_, i) => voStart + voDur * (0.08 + (0.72 * i) / Math.max(1, s.keywords.length)));
  if (s.kind === 'title') out.cues.title = voStart + voDur * frac(s.vo, 'Now imagine') - 0.3;
  if (s.kind === 'team') {
    out.cues.members = ['Imam', 'Ahad', 'Biswadev'].map((name) => voStart + voDur * frac(s.vo, name) - 0.2);
    out.cues.title = voStart + 0.1;
  }
  return out;
});
function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }
const chapterOrder = ['who', 'why', 'what', 'how'];
const subs = { who: 'WHO WE ARE', why: 'THE PROBLEM', what: 'THE BIG IDEA + DEMO', how: 'IMPACT + WHAT WE NEED' };
const chapters = Object.fromEntries(chapterOrder.map((k) => {
  const list = scenes.filter((s) => s.chapter === k);
  return [k, { label: script.chapters[k], sub: subs[k], start: list[0].start, end: list.at(-1).end }];
}));
const missing = [...new Set(scenes.flatMap((s) => s.clips))].filter((c) => !clips[c]);
const team = ['imam', 'ahad', 'biswadev'].map((k) => script.members[k]);
const timeline = { duration: TOTAL, fps: FPS, clips, scenes, team, chapters, chapterOrder };
writeFileSync(`${dir}timeline.json`, JSON.stringify(timeline, null, 2));
console.log(`tail ${tail.toFixed(2)} s · total ${t.toFixed(3)} s${missing.length ? ` · MISSING CLIPS: ${missing.join(', ')}` : ''}`);
for (const k of chapterOrder) console.log(`${chapters[k].label.padEnd(10)} ${chapters[k].start.toFixed(1).padStart(6)} → ${chapters[k].end.toFixed(1).padStart(6)}  (${(chapters[k].end - chapters[k].start).toFixed(1)} s)`);
for (const s of scenes) console.log(`  ${s.id.padEnd(14)} ${s.start.toFixed(2).padStart(7)} → ${s.end.toFixed(2).padStart(7)}  vo@${s.voStart.toFixed(2)} (${s.voDur.toFixed(1)}s)  ${s.speeds.map((x) => x.toFixed(2)).join(' ')}`);
if (mode === 'timeline') process.exit(0);
if (missing.length) throw new Error(`missing clips: ${missing.join(', ')}`);

// ---- Deterministic frame render in headless Chrome ----
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--remote-debugging-port=9338', '--allow-file-access-from-files', '--hide-scrollbars', '--force-color-profile=srgb', `--user-data-dir=${dir}chrome-render`, '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  let target;
  for (let i = 0; i < 80 && !target; i++) { await sleep(250); try { target = (await (await fetch('http://127.0.0.1:9338/json')).json()).find((x) => x.type === 'page'); } catch {} }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pending = new Map(); const errors = [];
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m.error); pending.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description); });
  const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  const loaded = new Promise((r) => ws.addEventListener('message', (e) => { if (JSON.parse(e.data).method === 'Page.loadEventFired') r(); }));
  await send('Page.navigate', { url: `file://${dir}compositor.html` });
  await loaded;
  const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description); return r.result?.value; };
  await ev(`setup(${JSON.stringify(timeline)})`);
  const shoot = async (time, file) => { await ev(`renderFrame(${time})`); const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 93, optimizeForSpeed: true }); writeFileSync(file, Buffer.from(data, 'base64')); };
  if (mode === 'stills') {
    mkdirSync(`${dir}stills`, { recursive: true });
    for (const s of arg.split(',').map(Number)) await shoot(s, `${dir}stills/s_${String(s.toFixed(1)).padStart(6, '0')}.jpg`);
  } else {
    mkdirSync(`${dir}frames`, { recursive: true });
    const [a, b] = (arg ?? `0-${TOTAL * FPS - 1}`).split('-').map(Number);
    const started = Date.now();
    for (let f = a; f <= b; f++) {
      await shoot(f / FPS, `${dir}frames/f_${String(f).padStart(5, '0')}.jpg`);
      if (f % 600 === 0) console.log(`frame ${f}/${b} · ${((Date.now() - started) / (f - a + 1)).toFixed(0)} ms/frame`);
    }
  }
  if (errors.length) { console.log('page errors:', errors.slice(0, 5)); process.exitCode = 1; }
  ws.close();
} finally { chrome.kill(); }
