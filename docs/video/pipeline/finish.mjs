// Encode frames + soundtrack → final MP4 (exactly 240 s), thumbnail intro + cover art, and SRT captions.
// usage: node finish.mjs <outDir>
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url).pathname;
const out = process.argv[2];
if (!out) throw new Error('usage: node finish.mjs <outDir>');
const tl = JSON.parse(readFileSync(`${dir}timeline.json`, 'utf8'));
const name = 'binary-explorers-mars-explorer';
const thumb = `${out}/thumbnail-1080p.jpg`;

// Captions: split each line into sentences, time them by character share of the voice clip, max 2 lines × 46 chars.
const ts = (s) => { const ms = Math.round(s * 1000), p = (n, w = 2) => String(n).padStart(w, '0'); return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`; };
let n = 0; const cues = [];
for (const s of tl.scenes) {
  const vo = s.vo.replace('A-star', 'A*');
  const parts = vo.split(/(?<=[.!?…:])\s+/).filter(Boolean);
  const chars = parts.reduce((a, p) => a + p.length, 0);
  let t = s.voStart;
  for (const p of parts) {
    const d = (s.voDur * p.length) / chars;
    const lines = p.replace(/\s+/g, ' ').replace(/(.{1,46})(\s|$)/g, '$1\n').trim().split('\n');
    const blocks = []; for (let i = 0; i < lines.length; i += 2) blocks.push(lines.slice(i, i + 2).join('\n'));
    const per = d / blocks.length;
    blocks.forEach((b, i) => cues.push(`${++n}\n${ts(t + i * per)} --> ${ts(t + (i + 1) * per - 0.05)}\n${b}\n`));
    t += d;
  }
}
writeFileSync(`${out}/${name}.srt`, cues.join('\n'));

const ff = (...args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
// Thumbnail holds the first 1.8 s and fades into the film; audio is untouched.
ff('-framerate', '30', '-i', `${dir}frames/f_%05d.jpg`, '-loop', '1', '-t', '1.8', '-i', thumb, '-i', `${dir}audio/final.wav`,
  '-filter_complex', '[1:v]format=yuva420p,fade=t=out:st=1.3:d=0.5:alpha=1[t];[0:v][t]overlay=eof_action=pass,format=yuv420p[v]',
  '-map', '[v]', '-map', '2:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', '30',
  '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-t', '240', '-movflags', '+faststart', `${dir}film.mp4`);
ff('-i', `${dir}film.mp4`, '-i', thumb, '-map', '0', '-map', '1', '-c', 'copy', '-disposition:v:1', 'attached_pic', '-movflags', '+faststart', `${out}/${name}.mp4`);
console.log(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=index,codec_name,width,height,duration', '-of', 'compact', `${out}/${name}.mp4`]).toString());
console.log(`${n} caption cues → ${out}/${name}.srt`);
