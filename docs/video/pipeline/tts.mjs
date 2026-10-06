// One voiceover clip per scene with Gemini TTS → vo/<id>.wav (48 kHz, trimmed, loudness-normalized) + vo/durations.json.
// usage: GEMINI_API_KEY=… node tts.mjs [sceneId…]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url).pathname;
const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error('GEMINI_API_KEY required');
const script = JSON.parse(readFileSync(`${dir}script.json`, 'utf8'));
mkdirSync(`${dir}vo`, { recursive: true });
const reprocess = process.argv.includes('--reprocess');
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const tempo = script.tempo ?? 1;
const durations = existsSync(`${dir}vo/durations.json`) ? JSON.parse(readFileSync(`${dir}vo/durations.json`, 'utf8')) : {};
for (const scene of script.scenes) {
  if (only.length && !only.includes(scene.id)) continue;
  const pcm = `${dir}vo/${scene.id}.pcm`, wav = `${dir}vo/${scene.id}.wav`;
  if (!reprocess) {
  let data;
  for (let attempt = 0; attempt < 6 && !data; attempt++) {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts: [{ text: `${script.style}\n\n${scene.vo}` }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: script.voice } } } } }),
    }).catch(() => null);
    if (res?.ok) data = await res.json();
    else { console.log(`${scene.id}: HTTP ${res?.status}, retrying`); await new Promise((r) => setTimeout(r, 2500 * (attempt + 1))); }
  }
  const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) throw new Error(`${scene.id}: no audio`);
  writeFileSync(pcm, Buffer.from(part.inlineData.data, 'base64'));
  }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', pcm,
    '-af', `silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse,highpass=f=70,atempo=${tempo},loudnorm=I=-17:TP=-2:LRA=9,aresample=48000`, '-ac', '1', wav]);
  durations[scene.id] = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav]).toString());
  console.log(`${scene.id}: ${durations[scene.id].toFixed(2)} s`);
  writeFileSync(`${dir}vo/durations.json`, JSON.stringify(durations, null, 2));
}
const total = script.scenes.reduce((a, s) => a + (durations[s.id] ?? 0), 0);
console.log('total VO', total.toFixed(1), 's of', script.duration);
