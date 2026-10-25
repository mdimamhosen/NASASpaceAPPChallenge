import { io, type Socket } from 'socket.io-client';
import type { AgentStep, Provenance } from '@mars-explorer/shared';

const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Mic → 16 kHz mono PCM16 in ~100 ms chunks. Runs on the audio thread; the AudioContext is created at 16 kHz so no resampling here.
const WORKLET = `class Pcm16 extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Int16Array(1600); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    let sum = 0;
    for (let i = 0; i < ch.length; i++) {
      const s = Math.max(-1, Math.min(1, ch[i]));
      sum += s * s;
      this.buf[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.n === this.buf.length) { this.port.postMessage({ pcm: this.buf.buffer.slice(0) }); this.n = 0; }
    }
    this.port.postMessage({ level: Math.sqrt(sum / ch.length) });
    return true;
  }
}
registerProcessor('pcm16', Pcm16);`;

export type LiveHandlers = {
  onReady?: (model: string) => void;
  onCaption?: (role: 'user' | 'model', text: string) => void;
  onTurn?: (turn: { user: string; text: string; provenance?: Provenance }) => void;
  onStep?: (step: AgentStep) => void;
  onRoute?: (waypoints: Array<{ lat: number; lon: number }>) => void;
  onLevel?: (level: number) => void;
  onSpeaking?: (speaking: boolean) => void;
  onLatency?: (ms: number) => void;
  onEnded?: (reason: string, message: string) => void;
};

/** Asks the API whether Live voice is available (network, key, not OFFLINE). Resolves 'unreachable' if the API is down. */
export function liveStatus(timeoutMs = 3000): Promise<{ available: boolean; reason: string | null }> {
  return new Promise((resolve) => {
    const s = io(`${base}/voice-live`, { transports: ['websocket'], reconnection: false, timeout: timeoutMs });
    const done = (v: { available: boolean; reason: string | null }) => { clearTimeout(t); s.close(); resolve(v); };
    const t = setTimeout(() => done({ available: false, reason: 'unreachable' }), timeoutMs);
    s.on('live.status', done);
    s.on('connect_error', () => done({ available: false, reason: 'unreachable' }));
  });
}

/**
 * Tier 1: full-duplex voice through the API's Gemini Live relay. The browser never sees the key; audio is relayed, not stored.
 * Barge-in: when Gemini reports `interrupted`, queued playback is dropped immediately.
 */
export class LiveVoice {
  private socket?: Socket;
  private mic?: MediaStream;
  private capture?: AudioContext;
  private playback?: AudioContext;
  private playing: AudioBufferSourceNode[] = [];
  private nextAt = 0;
  private userSpokeAt = 0;
  private awaitingFirstAudio = false;
  private handlers: LiveHandlers;

  constructor(handlers: LiveHandlers) { this.handlers = handlers; }

  async start(lang: string) {
    // getUserMedia first: it is the step that needs the user gesture and most often fails (permission).
    this.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    this.capture = new AudioContext({ sampleRate: 16000 });
    this.playback = new AudioContext({ sampleRate: 24000 });
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
    await this.capture.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const node = new AudioWorkletNode(this.capture, 'pcm16');
    this.capture.createMediaStreamSource(this.mic).connect(node);

    const socket = io(`${base}/voice-live`, { transports: ['websocket'], reconnection: false });
    this.socket = socket;
    let ready = false;
    // Keep up to 6 s of speech captured while the session connects, so the user can talk straight away.
    const early: ArrayBuffer[] = [];
    node.port.onmessage = (e: MessageEvent<{ pcm?: ArrayBuffer; level?: number }>) => {
      if (e.data.level != null) this.handlers.onLevel?.(e.data.level);
      if (!e.data.pcm) return;
      if (ready) socket.emit('audio', e.data.pcm);
      else if (early.length < 60) early.push(e.data.pcm);
    };
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Live voice did not start in 8 s')), 8000);
      socket.on('live.status', (s: { available: boolean; reason: string | null }) => { if (s.available) socket.emit('start', { lang }); else { clearTimeout(t); reject(new Error(`live unavailable: ${s.reason}`)); } });
      socket.on('live.ready', ({ model }: { model: string }) => { clearTimeout(t); ready = true; early.splice(0).forEach((c) => socket.emit('audio', c)); this.handlers.onReady?.(model); resolve(); });
      socket.on('live.error', (e: { message: string }) => { clearTimeout(t); reject(new Error(e.message)); });
      socket.on('connect_error', () => { clearTimeout(t); reject(new Error('API unreachable')); });
    });
    socket.on('live.caption', ({ role, text }: { role: 'user' | 'model'; text: string }) => {
      if (role === 'user') { this.userSpokeAt = performance.now(); this.awaitingFirstAudio = true; }
      this.handlers.onCaption?.(role, text);
    });
    socket.on('live.audio', (chunk: ArrayBuffer) => this.play(chunk));
    // Browser-side tools (navigation, map commands, describe screen); VoiceGlobe answers through the reply callback.
    socket.on('live.clientTool', (data: { name: string; args: Record<string, unknown> }, ack: (r: unknown) => void) => window.dispatchEvent(new CustomEvent('me-live-client-tool', { detail: { ...data, reply: ack } })));
    socket.on('live.interrupted', () => this.flush());
    socket.on('live.turn', (turn: { user: string; text: string; provenance?: Provenance }) => this.handlers.onTurn?.(turn));
    socket.on('live.step', (step: AgentStep) => this.handlers.onStep?.(step));
    socket.on('live.route', (route: Array<{ lat: number; lon: number }>) => this.handlers.onRoute?.(route));
    socket.on('live.ended', ({ reason, message }: { reason: string; message: string }) => { this.handlers.onEnded?.(reason, message); this.stop(); });
    socket.on('disconnect', () => { if (this.socket === socket) { this.handlers.onEnded?.('disconnected', 'Live connection lost.'); this.stop(); } });
  }

  /** Typed input in the same live conversation. */
  sendText(text: string) { this.userSpokeAt = performance.now(); this.awaitingFirstAudio = true; this.socket?.emit('text', { text }); }

  private play(chunk: ArrayBuffer) {
    const ctx = this.playback;
    if (!ctx) return;
    if (this.awaitingFirstAudio) { this.awaitingFirstAudio = false; this.handlers.onLatency?.(Math.round(performance.now() - this.userSpokeAt)); }
    const pcm = new Int16Array(chunk);
    const buf = ctx.createBuffer(1, pcm.length, 24000);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 0x8000;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    this.nextAt = Math.max(this.nextAt, ctx.currentTime + 0.03);
    src.start(this.nextAt);
    this.nextAt += buf.duration;
    this.playing.push(src);
    this.handlers.onSpeaking?.(true);
    src.onended = () => {
      this.playing = this.playing.filter((s) => s !== src);
      if (!this.playing.length) this.handlers.onSpeaking?.(false);
    };
  }

  /** Drop queued speech (barge-in or user stop). */
  flush() {
    this.playing.forEach((s) => { try { s.stop(); } catch { /* already ended */ } });
    this.playing = [];
    this.nextAt = 0;
    this.handlers.onSpeaking?.(false);
  }

  stop() {
    const socket = this.socket;
    this.socket = undefined;
    socket?.emit('stop');
    socket?.close();
    this.flush();
    this.mic?.getTracks().forEach((t) => t.stop());
    void this.capture?.close().catch(() => undefined);
    void this.playback?.close().catch(() => undefined);
    this.mic = undefined; this.capture = undefined; this.playback = undefined;
  }
}

/** Tier 2: record while held, then transcribe on the API (Gemini). Returns null text when the API cannot transcribe. */
export class PushToTalk {
  private rec?: MediaRecorder;
  private stream?: MediaStream;
  private chunks: Blob[] = [];
  private ctx?: AudioContext;
  private raf = 0;

  async start(onLevel?: (level: number) => void) {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    const mime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m));
    this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
    this.rec.start(250);
    if (onLevel) {
      this.ctx = new AudioContext();
      const an = this.ctx.createAnalyser();
      an.fftSize = 512;
      this.ctx.createMediaStreamSource(this.stream).connect(an);
      const data = new Float32Array(an.fftSize);
      const tick = () => { an.getFloatTimeDomainData(data); onLevel(Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length)); this.raf = requestAnimationFrame(tick); };
      tick();
    }
  }

  get recording() { return this.rec?.state === 'recording'; }

  /** Stops recording and returns the transcript; `text: null` means fall back to on-device recognition or typing. */
  async stop(lang: string): Promise<{ text: string | null; ms: number }> {
    const rec = this.rec;
    if (!rec) return { text: null, ms: 0 };
    await new Promise<void>((r) => { rec.onstop = () => r(); rec.stop(); });
    cancelAnimationFrame(this.raf);
    void this.ctx?.close().catch(() => undefined);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.rec = undefined;
    const blob = new Blob(this.chunks, { type: rec.mimeType || 'audio/webm' });
    if (blob.size < 1200) return { text: '', ms: 0 }; // under ~0.3 s: nothing said
    if (blob.size > 300_000) throw new Error('Recording too long. Keep push-to-talk under 30 seconds.');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const t = performance.now();
    const res = await fetch(`${base}/voice/transcribe`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ audio: btoa(bin), mime: blob.type.split(';')[0] || 'audio/webm', lang }) });
    if (res.status === 429) throw new Error('Voice rate limit reached. Wait a minute or type your question.');
    if (!res.ok) throw new Error(`Transcription failed (HTTP ${res.status}).`);
    const data = (await res.json()) as { text: string | null };
    return { text: data.text, ms: Math.round(performance.now() - t) };
  }

  cancel() {
    try { this.rec?.stop(); } catch { /* not started */ }
    cancelAnimationFrame(this.raf);
    void this.ctx?.close().catch(() => undefined);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.rec = undefined;
  }
}
