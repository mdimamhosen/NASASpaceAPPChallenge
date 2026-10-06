// Build the 240.000 s soundtrack: ambient pad (ducked under voice) + placed voice lines + sparse soft swells.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url).pathname;
const tl = JSON.parse(readFileSync(`${dir}timeline.json`, 'utf8'));
const A = `${dir}audio`; mkdirSync(A, { recursive: true });
const ff = (...args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);

// Four warm chords (Am – F – C – G), each 20 s with 4 s fades, chained with 4 s crossfades.
const CHORDS = [[110, 164.81, 220, 261.63, 329.63], [87.31, 130.81, 174.61, 220, 261.63], [130.81, 196, 261.63, 329.63, 392], [98, 146.83, 196, 246.94, 293.66]];
CHORDS.forEach((notes, i) => {
  const expr = notes.map((f, j) => `0.05*(sin(2*PI*${f}*t)+0.55*sin(2*PI*${(f * 1.0035).toFixed(3)}*t)+0.18*sin(2*PI*${2 * f}*t))*(0.72+0.28*sin(2*PI*${(0.07 + j * 0.013).toFixed(3)}*t+${j}))`).join('+');
  ff('-f', 'lavfi', '-i', `aevalsrc=${expr}:s=48000:d=20`, '-af', 'lowpass=f=1500,aecho=0.8:0.55:160|320:0.22|0.14,afade=t=in:d=4:curve=qsin,afade=t=out:st=16:d=4:curve=qsin', '-ac', '2', `${A}/chord${i}.wav`);
});
const SEGMENTS = 15; // 15 × 20 s − 14 × 4 s overlap = 244 s
const inputs = Array.from({ length: SEGMENTS }, (_, k) => ['-i', `${A}/chord${k % 4}.wav`]).flat();
let chain = '[0][1]acrossfade=d=4:c1=qsin:c2=qsin[x1]';
for (let k = 2; k < SEGMENTS; k++) chain += `;[x${k - 1}][${k}]acrossfade=d=4:c1=qsin:c2=qsin[x${k}]`;
ff(...inputs, '-filter_complex', `${chain};[x${SEGMENTS - 1}]atrim=0:240,volume=0.9[out]`, '-map', '[out]', `${A}/music.wav`);

// Soft swell for motivated moments only.
ff('-f', 'lavfi', '-i', 'anoisesrc=color=pink:d=1.6:a=0.6', '-af', 'highpass=f=350,lowpass=f=5200,afade=t=in:d=0.9:curve=qsin,afade=t=out:st=0.9:d=0.7:curve=qsin,volume=0.16', '-ac', '2', `${A}/swell.wav`);
// Swells on the title reveal and on each chapter card (WHY, WHAT, HOW).
const swells = [tl.scenes[0].cues.title - 0.6, ...tl.chapterOrder.slice(1).map((k) => tl.chapters[k].start - 0.6)];

// Voice bus: each line at its cue.
const voInputs = tl.scenes.flatMap((s) => ['-i', `${dir}vo/${s.id}.wav`]);
const voFilters = tl.scenes.map((s, i) => `[${i}]adelay=${Math.round(s.voStart * 1000)}:all=1,aformat=channel_layouts=stereo[v${i}]`).join(';');
ff(...voInputs, '-filter_complex', `${voFilters};${tl.scenes.map((_, i) => `[v${i}]`).join('')}amix=inputs=${tl.scenes.length}:normalize=0,apad=whole_dur=240,atrim=0:240[out]`, '-map', '[out]', '-ar', '48000', `${A}/voice.wav`);

// Swell bus.
const swInputs = swells.flatMap(() => ['-i', `${A}/swell.wav`]);
ff(...swInputs, '-filter_complex', `${swells.map((t, i) => `[${i}]adelay=${Math.round(Math.max(0, t) * 1000)}:all=1[s${i}]`).join(';')};${swells.map((_, i) => `[s${i}]`).join('')}amix=inputs=${swells.length}:normalize=0,apad=whole_dur=240,atrim=0:240[out]`, '-map', '[out]', `${A}/swells.wav`);

// Final mix: duck the pad under the voice, keep the voice dominant, normalize, exact length, gentle head/tail fades.
ff('-i', `${A}/music.wav`, '-i', `${A}/voice.wav`, '-i', `${A}/swells.wav`, '-filter_complex', [
  '[1]asplit=2[vo][key]',
  '[0]volume=0.55[mu]',
  '[mu][key]sidechaincompress=threshold=0.02:ratio=7:attack=150:release=1100:makeup=1[duck]',
  '[duck][vo][2]amix=inputs=3:normalize=0:weights=1 1 1[mix]',
  '[mix]loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,afade=t=in:d=1.2:curve=qsin,afade=t=out:st=237.4:d=2.6:curve=qsin,apad=whole_dur=240,atrim=0:240[out]',
].join(';'), '-map', '[out]', '-c:a', 'pcm_s16le', `${A}/final.wav`);
console.log('final', execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `${A}/final.wav`]).toString().trim(), 's');
