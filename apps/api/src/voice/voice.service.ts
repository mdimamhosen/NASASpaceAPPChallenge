import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { isOffline } from '../common/offline';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';
const TTS_MODELS = ['gemini-3.8-flash-tts', 'gemini-2.5-flash-preview-tts'];
const STT_MODELS = ['gemini-3.5-transcribe', 'gemini-2.5-flash'];
export const VOICE_LANGS = ['en', 'bn', 'es', 'fr', 'hi'] as const;
export type VoiceLang = (typeof VOICE_LANGS)[number];

type CacheEntry = { expires: number; mime: string; buffer: Buffer };

/** Wrap Gemini L16 PCM in a WAV container so browsers can play it. */
function pcm16ToWav(pcm: Buffer, sampleRate = 24_000, channels = 1): Buffer {
  const dataSize = pcm.length;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}

function parseL16Rate(mime: string): number {
  const m = mime.match(/rate\s*=\s*(\d+)/i);
  return m ? Number(m[1]) : 24_000;
}

@Injectable()
export class VoiceService {
  private readonly log = new Logger(VoiceService.name);
  private readonly cache = new Map<string, CacheEntry>();

  private get key() {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  }

  /** Short NASA-console TTS. Returns null when no key / offline so the client can use SpeechSynthesis. */
  async speak(text: string, lang: VoiceLang = 'en'): Promise<{ mime: string; buffer: Buffer; source: 'gemini' } | null> {
    const clean = text.replace(/\s+/g, ' ').trim().slice(0, 800);
    if (clean.length < 1) throw new ServiceUnavailableException('Empty speech text.');
    if (isOffline() || !this.key) return null;

    const hash = createHash('sha256').update(`wav:${lang}:${clean}`).digest('hex');
    const hit = this.cache.get(hash);
    if (hit && hit.expires > Date.now()) return { mime: hit.mime, buffer: hit.buffer, source: 'gemini' };

    const voiceName = lang === 'en' ? 'Aoede' : 'Kore';
    const style = lang === 'en'
      ? 'Speak clearly in a calm mission-console voice. Keep NASA product names exact.'
      : `Speak clearly in ${LANG_NAMES[lang]}. Keep NASA product names and numbers exact.`;

    // Newest TTS first; older model kept as a fallback when the preview is unavailable or rate-limited.
    let res: Response | null = null;
    for (const model of TTS_MODELS) {
      res = await fetch(`${GEMINI}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${style}\n\n${clean}` }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
          },
        }),
        signal: AbortSignal.timeout(20_000),
      }).catch((error) => {
        this.log.warn(`Gemini TTS ${model} failed: ${String(error)}`);
        return null;
      });
      if (res?.ok) break;
      this.log.warn(`Gemini TTS ${model} HTTP ${res?.status ?? 'network'}`);
    }
    if (!res?.ok) return null;

    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }> };
    const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part?.inlineData?.data) return null;

    const raw = Buffer.from(part.inlineData.data, 'base64');
    const srcMime = part.inlineData.mimeType || 'audio/l16;rate=24000';
    const isPcm = /l16|pcm|linear/i.test(srcMime) || (!/wav|mpeg|mp3|ogg|webm/i.test(srcMime) && raw.length > 44 && raw.toString('ascii', 0, 4) !== 'RIFF');
    const buffer = isPcm ? pcm16ToWav(raw, parseL16Rate(srcMime)) : raw;
    const mime = isPcm ? 'audio/wav' : (srcMime.startsWith('audio/') ? srcMime : 'audio/wav');

    this.cache.set(hash, { expires: Date.now() + 30 * 60_000, mime, buffer });
    if (this.cache.size > 80) this.cache.delete(this.cache.keys().next().value!);
    return { mime, buffer, source: 'gemini' };
  }

  /**
   * Streaming TTS: yields raw PCM16 (24 kHz mono) as Gemini produces it, so the first audio plays in ~1.5 s.
   * Returns null offline or without a key (the browser then speaks with SpeechSynthesis).
   */
  async speakStream(text: string, lang: VoiceLang = 'en', signal?: AbortSignal): Promise<AsyncGenerator<Buffer> | null> {
    const clean = text.replace(/\s+/g, ' ').trim().slice(0, 800);
    if (!clean || isOffline() || !this.key) return null;
    const style = lang === 'en' ? 'Read this in a calm, clear mission-console voice:' : `Read this clearly in ${LANG_NAMES[lang]}; keep NASA names and numbers exact:`;
    for (const model of TTS_MODELS) {
      const res = await fetch(`${GEMINI}/${model}:streamGenerateContent?alt=sse`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.key },
        body: JSON.stringify({ contents: [{ parts: [{ text: `${style}\n\n${clean}` }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: lang === 'en' ? 'Aoede' : 'Kore' } } } } }),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
      }).catch((error) => { this.log.warn(`TTS stream ${model} failed: ${String(error)}`); return null; });
      if (!res?.ok || !res.body) { this.log.warn(`TTS stream ${model} HTTP ${res?.status ?? 'network'}`); continue; }
      const body = res.body;
      return (async function* () {
        const decoder = new TextDecoder();
        let pending = '';
        for await (const part of body as unknown as AsyncIterable<Uint8Array>) {
          pending += decoder.decode(part, { stream: true });
          const events = pending.split(/\r?\n\r?\n/);
          pending = events.pop() ?? '';
          for (const ev of events) {
            const line = ev.split(/\r?\n/).find((l) => l.startsWith('data:'));
            if (!line) continue;
            const data = JSON.parse(line.slice(5)) as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }> };
            for (const p of data.candidates?.[0]?.content?.parts ?? []) if (p.inlineData?.data) yield Buffer.from(p.inlineData.data, 'base64');
          }
        }
      })();
    }
    return null;
  }

  /**
   * Push-to-talk speech to text. Audio is sent to Gemini and never stored. Returns null offline or without a key,
   * so the browser falls back to on-device recognition or typed input.
   */
  async transcribe(audioBase64: string, mime: string, lang: VoiceLang = 'en'): Promise<{ text: string; model: string; ms: number } | null> {
    if (isOffline() || !this.key) return null;
    const started = Date.now();
    const hint = `Transcribe this speech verbatim${lang === 'en' ? '' : ` (it may be in ${LANG_NAMES[lang]} or English)`}. Mars terms to expect: Perseverance, Jezero, sol, PLACES, EONET, Ingenuity, Marswalk. Output only the transcript.`;
    for (const model of STT_MODELS) {
      const res = await fetch(`${GEMINI}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.key },
        body: JSON.stringify({ contents: [{ parts: [{ inlineData: { mimeType: mime, data: audioBase64 } }, { text: hint }] }] }),
        signal: AbortSignal.timeout(20_000),
      }).catch((error) => { this.log.warn(`transcribe ${model} failed: ${String(error)}`); return null; });
      if (!res?.ok) { this.log.warn(`transcribe ${model} HTTP ${res?.status ?? 'network'}`); continue; }
      const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; audioTranscription?: { text?: string } }> } }> };
      const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.audioTranscription?.text ?? p.text ?? '').join(' ').replace(/\s+/g, ' ').trim();
      if (text) return { text: text.slice(0, 500), model, ms: Date.now() - started };
    }
    return null;
  }
}

const LANG_NAMES: Record<VoiceLang, string> = { en: 'English', bn: 'Bangla', es: 'Spanish', fr: 'French', hi: 'Hindi' };
