#!/usr/bin/env node
/**
 * Voice smoke against a running API: push-to-talk transcription and one Gemini Live turn through the relay,
 * both with the committed WAV fixture. Skips (exit 0) when the API reports offline or no key.
 * Usage: API_URL=http://localhost:4000 node scripts/smoke-voice.mjs
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const { io } = createRequire(new URL('../apps/web/package.json', import.meta.url))('socket.io-client');
const base = process.env.API_URL || 'http://localhost:4000';
const wav = readFileSync(new URL('../data/fixtures/voice/where-sol-400.wav', import.meta.url));
const expect = /perseverance/i;

const t = Date.now();
const res = await fetch(`${base}/voice/transcribe`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ audio: wav.toString('base64'), mime: 'audio/wav' }) });
const stt = await res.json();
if (res.status !== 200) throw new Error(`transcribe HTTP ${res.status}: ${JSON.stringify(stt)}`);
if (stt.text === null) { console.log('SKIP transcribe: Gemini unavailable (OFFLINE=1, no key, or quota/HTTP 429; see the API log). The app falls back to on-device speech.'); process.exit(0); }
if (!expect.test(stt.text) || !/400/.test(stt.text)) throw new Error(`unexpected transcript: ${stt.text}`);
console.log(`OK transcribe ${Date.now() - t} ms (${stt.model}): ${stt.text}`);

const socket = io(`${base}/voice-live`, { transports: ['websocket'] });
const result = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('live: no answer within 45 s')), 45_000);
  const seen = { tools: [], audio: 0, user: '', start: Date.now(), firstAudio: 0 };
  socket.on('live.status', (s) => { if (!s.available) { clearTimeout(timer); resolve({ skipped: s.reason }); } else socket.emit('start', { lang: 'en' }); });
  socket.on('live.error', (e) => { clearTimeout(timer); reject(new Error(`live.error ${e.code}: ${e.message}`)); });
  socket.on('live.ended', (e) => { clearTimeout(timer); reject(new Error(`live.ended ${e.reason}: ${e.message}`)); });
  socket.on('live.ready', async () => {
    const pcm = wav.subarray(44);
    for (let i = 0; i < pcm.length; i += 3200) { socket.emit('audio', pcm.subarray(i, i + 3200)); await new Promise((r) => setTimeout(r, 20)); }
    for (let i = 0; i < 40; i++) { socket.emit('audio', Buffer.alloc(3200)); await new Promise((r) => setTimeout(r, 20)); }
  });
  socket.on('live.step', (s) => seen.tools.push(`${s.tool}${s.kind === 'error' ? ' (error)' : ''}`));
  socket.on('live.caption', (c) => { if (c.role === 'user') seen.user = c.text; });
  socket.on('live.audio', (b) => { seen.audio += b.byteLength; seen.firstAudio ||= Date.now() - seen.start; });
  socket.on('live.turn', (turn) => { clearTimeout(timer); resolve({ ...seen, turn }); });
});
socket.close();
if (result.skipped) { console.log(`SKIP live: ${result.skipped}`); process.exit(0); }
const flagged = result.turn.provenance?.claims?.filter((c) => c.unmatched).map((c) => c.text) ?? [];
console.log(`OK live: heard "${result.user.trim()}" · tools ${result.tools.join(', ') || 'none'} · ${result.audio} audio bytes · first audio ${result.firstAudio} ms`);
console.log(`   answer: ${result.turn.text}`);
console.log(`   provenance: ${flagged.length ? `UNVERIFIED ${flagged.join(', ')}` : 'all numbers sourced'}`);
if (!result.tools.some((x) => /rover_position|verified_locations/.test(x)) || !result.audio) process.exit(1);
