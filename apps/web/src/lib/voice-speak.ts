const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

let activeAudio: HTMLAudioElement | null = null;
let audioUnlocked = false;

/** Call once from a user gesture (Turn on) so later TTS is allowed. */
export async function unlockAudio(): Promise<void> {
  if (typeof window === 'undefined') return;
  audioUnlocked = true;
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0.01;
      u.rate = 2;
      window.speechSynthesis.speak(u);
      window.speechSynthesis.cancel();
    }
  } catch { /* ignore */ }
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      await ctx.resume().catch(() => undefined);
      await ctx.close().catch(() => undefined);
    }
  } catch { /* ignore */ }
}

export function cancelSpeech() {
  if (typeof window === 'undefined') return;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  if (activeAudio) {
    try { activeAudio.pause(); activeAudio.src = ''; } catch { /* ignore */ }
    activeAudio = null;
  }
}

/** Prefer Gemini TTS via API (WAV); fall back to browser SpeechSynthesis. */
export async function speakText(text: string, lang: 'en' | 'bn' = 'en', signal?: AbortSignal): Promise<'gemini' | 'browser' | 'silent'> {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return 'silent';
  if (signal?.aborted) return 'silent';

  // Prefer browser TTS for short confirmations — fast and reliable after unlock.
  if (clean.length < 80 && audioUnlocked) {
    try {
      await browserSpeak(clean, lang, signal);
      return 'browser';
    } catch { /* try gemini */ }
  }

  try {
    const res = await fetch(`${base}/voice/speak`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: clean.slice(0, 800), lang }),
      signal,
    });
    if (res.status === 200 || res.status === 201) {
      const blob = await res.blob();
      if (blob.size > 44) {
        const url = URL.createObjectURL(blob);
        try {
          await playAudioUrl(url, signal);
          return 'gemini';
        } finally {
          URL.revokeObjectURL(url);
        }
      }
    }
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) return 'silent';
  }

  await browserSpeak(clean, lang, signal);
  return 'browser';
}

function playAudioUrl(url: string, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    cancelSpeech();
    const audio = new Audio(url);
    activeAudio = audio;
    const onAbort = () => {
      try { audio.pause(); } catch { /* ignore */ }
      activeAudio = null;
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    audio.onended = () => {
      signal?.removeEventListener('abort', onAbort);
      if (activeAudio === audio) activeAudio = null;
      resolve();
    };
    audio.onerror = () => {
      signal?.removeEventListener('abort', onAbort);
      if (activeAudio === audio) activeAudio = null;
      reject(new Error('audio play failed'));
    };
    void audio.play().catch((error) => {
      signal?.removeEventListener('abort', onAbort);
      if (activeAudio === audio) activeAudio = null;
      reject(error);
    });
  });
}

function browserSpeak(text: string, lang: 'en' | 'bn', signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) { resolve(); return; }
    if (signal?.aborted) { resolve(); return; }
    window.speechSynthesis.cancel();
    const chunks = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
    let i = 0;
    let settled = false;
    const finish = () => { if (!settled) { settled = true; resolve(); } };
    const fail = (error: unknown) => { if (!settled) { settled = true; reject(error); } };

    const next = () => {
      if (signal?.aborted || i >= chunks.length) { finish(); return; }
      const piece = chunks[i++].trim();
      if (!piece) { next(); return; }
      const u = new SpeechSynthesisUtterance(piece);
      u.lang = lang === 'bn' ? 'bn-BD' : 'en-US';
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find((v) => (lang === 'bn'
        ? /bn|bengali/i.test(v.lang)
        : /en(-|_)(US|GB)|Samantha|Google US English|Alex|Karen/i.test(`${v.lang} ${v.name}`)));
      if (preferred) u.voice = preferred;
      u.rate = 1.05;
      u.onend = next;
      u.onerror = () => next();
      try { window.speechSynthesis.speak(u); }
      catch (error) { fail(error); }
    };

    const onAbort = () => { window.speechSynthesis.cancel(); finish(); };
    signal?.addEventListener('abort', onAbort, { once: true });

    const start = () => next();
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => start();
      window.setTimeout(start, 120);
    } else start();
  });
}

/** Text for the ear: drop citation markers, markdown and URLs before speaking. */
export const speakable = (text: string) => text.replace(/\[\d+(?:[,\s]*\d+)*\]/g, '').replace(/https?:\/\/\S+/g, '').replace(/[*_#`>]/g, '').replace(/\s+/g, ' ').trim();

export type SpeechQueue = { push: (delta: string) => void; end: () => Promise<void>; stop: () => void };

/**
 * Sentence-streamed speech for a token stream: each finished sentence starts streaming TTS at once (prefetch), and
 * sentences play back-to-back on one audio timeline. Falls back to browser SpeechSynthesis when the API returns 204.
 */
export function createSpeechQueue(lang: string, opts: { onFirstAudio?: () => void; onDone?: () => void } = {}): SpeechQueue {
  const abort = new AbortController();
  let buffer = '', first = true, chain: Promise<void> = Promise.resolve();
  let ctx: AudioContext | null = null, nextAt = 0;
  const sources: AudioBufferSourceNode[] = [];

  const schedule = (pcm: Int16Array) => {
    ctx ??= new AudioContext({ sampleRate: 24000 });
    const buf = ctx.createBuffer(1, pcm.length, 24000);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 0x8000;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.connect(ctx.destination);
    nextAt = Math.max(nextAt, ctx.currentTime + 0.04);
    src.start(nextAt); nextAt += buf.duration;
    sources.push(src);
    if (first) { first = false; opts.onFirstAudio?.(); }
  };
  const drained = () => new Promise<void>((r) => { const wait = () => (!ctx || ctx.currentTime >= nextAt - 0.01 || abort.signal.aborted ? r() : setTimeout(wait, 80)); wait(); });

  const enqueue = (sentence: string) => {
    const text = speakable(sentence);
    if (!text) return;
    // Start the request now so it downloads while earlier sentences are still playing.
    const res = fetch(`${base}/voice/speak/stream`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: text.slice(0, 800), lang }), signal: abort.signal }).catch(() => null);
    chain = chain.then(async () => {
      if (abort.signal.aborted) return;
      const r = await res;
      if (r?.status === 200 && r.body) {
        const reader = r.body.getReader();
        let carry: Uint8Array | null = null;
        for (;;) {
          const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true }));
          if (done || abort.signal.aborted) break;
          let bytes = value!;
          if (carry) { const m = new Uint8Array(carry.length + bytes.length); m.set(carry); m.set(bytes, carry.length); bytes = m; carry = null; }
          if (bytes.length % 2) { carry = bytes.slice(-1); bytes = bytes.slice(0, -1); }
          if (bytes.length) schedule(new Int16Array(bytes.buffer, bytes.byteOffset, bytes.length / 2).slice());
        }
        return;
      }
      await drained();
      if (first) { first = false; opts.onFirstAudio?.(); }
      await browserSpeak(text, lang === 'bn' ? 'bn' : 'en', abort.signal).catch(() => undefined);
    });
  };

  return {
    push(delta) {
      buffer += delta;
      // A sentence ends at . ! ? or the Bangla danda, followed by space; skip decimals like 18.46.
      let m: RegExpMatchArray | null;
      while ((m = buffer.match(/^([\s\S]*?[.!?।])\s+(?=\S)/)) && m[1].length >= 12) { enqueue(m[1]); buffer = buffer.slice(m[0].length); }
    },
    async end() {
      if (buffer.trim()) enqueue(buffer);
      buffer = '';
      await chain;
      await drained();
      opts.onDone?.();
    },
    stop() {
      abort.abort();
      sources.forEach((s) => { try { s.stop(); } catch { /* ended */ } });
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
      void ctx?.close().catch(() => undefined);
      ctx = null;
    },
  };
}
