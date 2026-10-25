'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentRun, AgentStep } from '@mars-explorer/shared';
import { parseVoiceCommand, type VoiceCommandResult } from '@/lib/voice-commands';
import { emitVoiceSync, onVoiceSync, type VoiceSyncEvent } from '@/lib/voice-sync';
import { cancelSpeech, createSpeechQueue, speakText, unlockAudio, type SpeechQueue } from '@/lib/voice-speak';
import { LiveVoice, PushToTalk, liveStatus } from '@/lib/voice-live';
import { ThinkingOrb } from 'thinking-orbs';
import { describeScreen } from '@/lib/voice-screen';
import { agentStreamUrl } from '@/lib/api';

type Mode = 'off' | 'idle' | 'listening' | 'thinking' | 'speaking';
/** LIVE: Gemini Live relay. PTT: record → Gemini transcribe → agent → streamed TTS. OFFLINE: on-device Web Speech or typing. */
type Tier = 'live' | 'ptt' | 'offline';
type Lang = 'en' | 'bn';

type RecResult = { 0: { transcript: string }; isFinal: boolean; length: number };
type SR = {
  continuous: boolean; interimResults: boolean; lang: string; processLocally?: boolean;
  start: () => void; stop: () => void; abort: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<RecResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => SR) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/** Human next step for each microphone / recognition failure. */
function micError(error: unknown): string {
  const name = (error as { name?: string; error?: string })?.name ?? (error as { error?: string })?.error ?? '';
  if (/NotAllowed|not-allowed|service-not-allowed|Security/i.test(name)) return 'Microphone blocked. Allow mic access in the address bar, or type below.';
  if (/NotFound|audio-capture|Overconstrained/i.test(name)) return 'No microphone found. Plug one in, or type below.';
  if (/NotReadable/i.test(name)) return 'The microphone is in use by another app. Close it, or type below.';
  if (/network/i.test(name)) return 'Speech service unreachable. Switch to push-to-talk or type below.';
  if (/no-speech/i.test(name)) return 'No speech heard. Tap the orb and speak.';
  return (error as Error)?.message || `Voice error: ${name || 'unknown'}.`;
}

const TIER_LABEL: Record<Tier, string> = { live: 'LIVE', ptt: 'PUSH-TO-TALK', offline: 'OFFLINE' };

export default function VoiceGlobe() {
  const router = useRouter();
  const [powered, setPowered] = useState(false);
  const [mode, setMode] = useState<Mode>('off');
  const [tier, setTier] = useState<Tier>('offline');
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<Lang>('en');
  const [caption, setCaption] = useState('Voice off · tap to turn on');
  const [heard, setHeard] = useState('');
  const [error, setError] = useState('');
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [latency, setLatency] = useState<number | null>(null);
  const [level, setLevel] = useState(0);
  const [flags, setFlags] = useState<string[]>([]);
  const [textCmd, setTextCmd] = useState('');
  const [liveReason, setLiveReason] = useState<string | null>(null);

  const poweredRef = useRef(false);
  const modeRef = useRef<Mode>('off');
  const tierRef = useRef<Tier>('offline');
  const langRef = useRef<Lang>('en');
  const recognitionRef = useRef<SR | null>(null);
  const liveRef = useRef<LiveVoice | null>(null);
  const pttRef = useRef<PushToTalk | null>(null);
  const queueRef = useRef<SpeechQueue | null>(null);
  const abortSpeak = useRef<AbortController | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const busyRef = useRef(false);
  const handleRef = useRef<(raw: string) => Promise<void>>(async () => undefined);

  const setModeSafe = (next: Mode) => { modeRef.current = next; setMode(next); };
  const setPoweredSafe = (on: boolean) => { poweredRef.current = on; setPowered(on); };
  const setTierSafe = (t: Tier) => { tierRef.current = t; setTier(t); };
  const fail = (message: string) => { setError(message); setCaption(message); setModeSafe(poweredRef.current ? 'idle' : 'off'); };

  const stopRecognition = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    try { rec.onresult = null; rec.onerror = null; rec.onend = null; rec.abort(); } catch { /* ignore */ }
    recognitionRef.current = null;
  }, []);

  const stopSpeak = useCallback(() => {
    abortSpeak.current?.abort();
    abortSpeak.current = null;
    queueRef.current?.stop();
    queueRef.current = null;
    esRef.current?.close();
    esRef.current = null;
    liveRef.current?.flush();
    cancelSpeech();
  }, []);

  const hardStop = useCallback(() => {
    busyRef.current = false;
    stopRecognition();
    pttRef.current?.cancel();
    stopSpeak();
    setLevel(0);
    setModeSafe(poweredRef.current ? 'idle' : 'off');
  }, [stopRecognition, stopSpeak]);

  /** Short confirmations (command acks). Answers use the sentence-streamed queue instead. */
  const say = useCallback(async (text: string) => {
    if (!text) return;
    stopSpeak();
    const ac = new AbortController();
    abortSpeak.current = ac;
    setModeSafe('speaking');
    setCaption(text.slice(0, 140));
    try { await speakText(text, langRef.current, ac.signal); } catch { /* aborted */ }
    if (!ac.signal.aborted) setModeSafe(poweredRef.current ? 'idle' : 'off');
  }, [stopSpeak]);

  const dispatchSync = useCallback((event: VoiceSyncEvent) => {
    if (event.type === 'navigate') { router.push(event.href); return; }
    if (event.type.startsWith('explore.') && window.location.pathname !== '/explore') {
      router.push('/explore');
      window.setTimeout(() => emitVoiceSync(event), 900);
      return;
    }
    if (event.type === 'research.ask') { router.push('/research'); window.setTimeout(() => emitVoiceSync(event), 450); return; }
    emitVoiceSync(event);
  }, [router]);

  /** Mission agent over SSE; the answer is spoken sentence by sentence while it streams. */
  const runAsk = useCallback(async (question: string) => {
    setModeSafe('thinking');
    setCaption('Checking NASA sources…');
    setSteps([]); setFlags([]);
    const started = performance.now();
    const queue = createSpeechQueue(langRef.current, {
      onFirstAudio: () => { setLatency(Math.round(performance.now() - started)); setModeSafe('speaking'); },
    });
    queueRef.current = queue;
    let answer = '';
    await new Promise<void>((resolve) => {
      const es = new EventSource(agentStreamUrl(question, tierRef.current !== 'offline', 'fast', langRef.current));
      esRef.current = es;
      let settled = false;
      const finish = () => { if (settled) return; settled = true; window.clearTimeout(timer); es.close(); resolve(); };
      const timer = window.setTimeout(finish, 45_000);
      es.addEventListener('step', (event) => { try { const s = JSON.parse((event as MessageEvent).data) as AgentStep; if (s.kind === 'tool' || s.kind === 'error') setSteps((prev) => [...prev, s].slice(-4)); } catch { /* ignore */ } });
      es.addEventListener('reset', () => { answer = ''; });
      es.addEventListener('token', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data) as string;
          if (typeof data !== 'string') return;
          answer += data;
          queue.push(data);
          setCaption(answer.slice(-160));
        } catch { /* ignore */ }
      });
      es.addEventListener('done', (event) => {
        try {
          const run = JSON.parse((event as MessageEvent).data) as AgentRun;
          if (!answer && run.answer) { answer = run.answer; queue.push(run.answer); }
          if (run.route?.length) dispatchSync({ type: 'explore.route', waypoints: run.route.map(({ lat, lon }) => ({ lat, lon })) });
          setFlags(run.provenance?.claims.filter((c) => c.unmatched).map((c) => c.text) ?? []);
        } catch { /* ignore */ }
        finish();
      });
      es.addEventListener('failed', () => finish());
      es.onerror = () => { if (!answer) fail('The agent is unreachable. Is the API running?'); finish(); };
    });
    if (!answer.trim()) queue.push('I could not gather enough NASA evidence for that.');
    setCaption(answer.trim().slice(0, 220) || 'No answer.');
    await queue.end();
    if (queueRef.current === queue) { queueRef.current = null; setModeSafe(poweredRef.current ? 'idle' : 'off'); }
  }, [dispatchSync]);

  /** Shared command path for push-to-talk, offline recognition and typed input. */
  const handleUtterance = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    const result: VoiceCommandResult = parseVoiceCommand(text);
    // Interrupt commands must stay available while an answer is being spoken.
    if (result.kind === 'stop') { hardStop(); setCaption('Stopped · tap the orb to talk'); return; }
    if (result.kind === 'power' && !result.on) { turnOffRef.current(); return; }
    if (busyRef.current) return;
    busyRef.current = true;
    stopRecognition();
    stopSpeak();
    setHeard(text);
    setError('');
    setCaption(text);
    try {
      if (result.kind === 'power') {
        if (!result.on) { turnOffRef.current(); return; }
        await say(result.say);
        return;
      }
      if (result.kind === 'describe') { await say(describeScreen() || 'Nothing to describe yet.'); return; }
      if (result.kind === 'ask') { await runAsk(result.question); return; }
      if (result.kind === 'sync') { dispatchSync(result.event); await say(result.say || 'Done.'); return; }
      await say(result.say);
    } finally {
      busyRef.current = false;
    }
  }, [dispatchSync, hardStop, runAsk, say, stopRecognition, stopSpeak]);
  handleRef.current = handleUtterance;

  /** Tier 3: browser speech recognition, on-device when the browser supports it. */
  const startRecognition = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) { setOpen(true); fail('Speech recognition is not available in this browser. Type below.'); return; }
    stopSpeak();
    stopRecognition();
    const rec = new Ctor();
    recognitionRef.current = rec;
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = langRef.current === 'bn' ? 'bn-BD' : 'en-US';
    if ('processLocally' in rec) rec.processLocally = tierRef.current === 'offline';
    let finalized = false;
    rec.onresult = (event) => {
      let interim = '', final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) final += piece; else interim += piece;
      }
      if ((final || interim).trim()) setCaption((final || interim).trim());
      if (final.trim() && !finalized) { finalized = true; try { rec.stop(); } catch { /* ignore */ } void handleRef.current(final.trim()); }
    };
    rec.onerror = (event) => { if (event.error !== 'aborted') fail(micError(event)); };
    rec.onend = () => { if (!finalized && modeRef.current === 'listening') setModeSafe('idle'); };
    try { rec.start(); setModeSafe('listening'); setCaption('Listening…'); setError(''); } catch (e) { fail(micError(e)); }
  }, [stopRecognition, stopSpeak]);

  /** Tier 2: hold (or tap to start / tap to stop). */
  const startPtt = useCallback(async () => {
    if (pttRef.current?.recording) return;
    stopSpeak();
    const ptt = new PushToTalk();
    pttRef.current = ptt;
    try {
      await ptt.start((l) => setLevel(l));
      setModeSafe('listening'); setCaption('Listening… release to send'); setError('');
    } catch (e) { pttRef.current = null; fail(micError(e)); }
  }, [stopSpeak]);

  const finishPtt = useCallback(async () => {
    const ptt = pttRef.current;
    if (!ptt?.recording) return;
    pttRef.current = null;
    setLevel(0);
    setModeSafe('thinking'); setCaption('Transcribing…');
    try {
      const { text } = await ptt.stop(langRef.current);
      if (text === null) { setTierSafe('offline'); fail('Cloud transcription is unavailable. Switched to offline voice. Tap the orb to talk.'); return; }
      if (!text) { fail('No speech heard. Hold the orb or V while you speak.'); return; }
      await handleRef.current(text);
    } catch (e) { fail((e as Error).message); }
  }, []);

  /** Tier 1: one Live session while powered. */
  const startLive = useCallback(async () => {
    liveRef.current?.stop();
    const live = new LiveVoice({
      onReady: () => { setModeSafe('listening'); setCaption('Live · just talk. Interrupt any time.'); },
      onCaption: (role, text) => {
        if (role === 'user') { setHeard(text); setCaption(text); setModeSafe('thinking'); setSteps([]); setFlags([]); }
        else setCaption(text.slice(-200));
      },
      onStep: (s) => { if (s.kind === 'tool' || s.kind === 'error') setSteps((prev) => [...prev, s].slice(-4)); },
      onRoute: (waypoints) => dispatchSync({ type: 'explore.route', waypoints }),
      onTurn: (turn) => setFlags(turn.provenance?.claims.filter((c) => c.unmatched).map((c) => c.text) ?? []),
      onSpeaking: (on) => setModeSafe(on ? 'speaking' : poweredRef.current ? 'listening' : 'off'),
      onLevel: (l) => setLevel(l),
      onLatency: (ms) => setLatency(ms),
      onEnded: (reason, message) => {
        if (liveRef.current !== live) return;
        liveRef.current = null;
        setLevel(0);
        if (reason === 'cap') { setModeSafe('idle'); setCaption(message); return; }
        setTierSafe('ptt');
        fail(`${message} Switched to push-to-talk.`);
      },
    });
    liveRef.current = live;
    setModeSafe('thinking'); setCaption('Connecting live voice…');
    try { await live.start(langRef.current); }
    catch (e) {
      if (liveRef.current === live) liveRef.current = null;
      live.stop();
      const msg = micError(e);
      if (/blocked|microphone|in use/i.test(msg)) { fail(msg); return; }
      setTierSafe('ptt');
      fail(`Live voice unavailable (${(e as Error).message}). Using push-to-talk.`);
    }
  }, [dispatchSync]);

  const talk = useCallback(() => {
    if (!poweredRef.current) { setOpen(true); return; }
    if (tierRef.current === 'live') { if (!liveRef.current) void startLive(); else { liveRef.current.flush(); } return; }
    if (tierRef.current === 'ptt') { if (pttRef.current?.recording) void finishPtt(); else void startPtt(); return; }
    startRecognition();
  }, [finishPtt, startLive, startPtt, startRecognition]);

  const turnOn = async (preferred?: Tier) => {
    setPoweredSafe(true);
    setOpen(false);
    setError('');
    await unlockAudio();
    const status = await liveStatus();
    setLiveReason(status.reason);
    const next: Tier = preferred ?? (status.available ? 'live' : 'offline');
    setTierSafe(status.available || next === 'offline' ? next : 'offline');
    if (tierRef.current === 'live') { await startLive(); return; }
    setModeSafe('idle');
    setCaption(tierRef.current === 'ptt' ? 'Push-to-talk · hold V or the orb while you speak' : status.reason === 'unreachable' ? 'Offline voice · API unreachable · tap the orb to talk' : 'Offline voice · on-device speech · tap the orb to talk');
  };

  const turnOff = () => {
    liveRef.current?.stop();
    liveRef.current = null;
    setPoweredSafe(false);
    hardStop();
    setModeSafe('off');
    setCaption('Voice off · tap to turn on');
    setOpen(false);
  };
  const turnOffRef = useRef(turnOff);
  turnOffRef.current = turnOff;

  const switchTier = (t: Tier) => {
    liveRef.current?.stop();
    liveRef.current = null;
    hardStop();
    setTierSafe(t);
    if (poweredRef.current) void turnOn(t);
  };

  useEffect(() => { langRef.current = lang; if (tierRef.current === 'live' && liveRef.current) void startLive(); }, [lang, startLive]);

  // Live mode: the model calls these browser tools for navigation, map commands and "describe this screen".
  useEffect(() => {
    const onTool = (e: Event) => {
      const { name, args, reply } = (e as CustomEvent<{ name: string; args: { command?: string }; reply: (r: unknown) => void }>).detail;
      if (name === 'describe_screen') { reply({ screen: describeScreen() }); return; }
      const cmd = parseVoiceCommand(String(args.command ?? ''));
      if (cmd.kind === 'sync') { dispatchSync(cmd.event); reply({ done: true, did: cmd.say }); return; }
      reply({ done: false, reason: 'not a UI command; answer with data tools instead' });
    };
    window.addEventListener('me-live-client-tool', onTool);
    return () => window.removeEventListener('me-live-client-tool', onTool);
  }, [dispatchSync]);

  useEffect(() => onVoiceSync((event) => {
    if (event.type === 'speak' && event.text) void say(event.text);
    if (event.type === 'status') setCaption(event.message);
    if (event.type === 'voice.power') { if (event.on) void turnOn(); else turnOff(); }
  // turnOn/turnOff read refs, so a stale closure is safe here
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [say]);

  // Hold V to talk (push-to-talk), tap V otherwise; Escape stops everything.
  useEffect(() => {
    const typing = (t: EventTarget | null) => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable);
    const down = (event: KeyboardEvent) => {
      if (typing(event.target) || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() === 'v' && poweredRef.current) {
        event.preventDefault();
        if (tierRef.current === 'ptt') void startPtt(); else talk();
      }
      if (event.key === 'Escape') { hardStop(); setOpen(false); setCaption(poweredRef.current ? 'Stopped' : 'Voice off · tap to turn on'); }
    };
    const up = (event: KeyboardEvent) => { if (event.key.toLowerCase() === 'v' && tierRef.current === 'ptt') void finishPtt(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [finishPtt, hardStop, startPtt, talk]);

  useEffect(() => () => { liveRef.current?.stop(); hardStop(); }, [hardStop]);

  const orbClass = `voice-globe-orb voice-${mode}${powered ? ' powered' : ''}`;
  const bars = [0.6, 1, 0.8, 1, 0.6];

  return (
    <div className="voice-globe" data-powered={powered ? '1' : '0'}>
      <div className="voice-globe-caption">
        {powered && <span className={`voice-tier tier-${tier}`}>{TIER_LABEL[tier]}</span>}
        <p aria-live="polite" aria-atomic="true">{caption}</p>
        {steps.length > 0 && <ul className="voice-steps" aria-label="Agent tools used">{steps.map((s) => <li key={s.i} className={s.kind === 'error' ? 'err' : ''}>{s.tool}</li>)}</ul>}
        {flags.length > 0 && <small className="voice-flag" role="note">UNVERIFIED NUMBER{flags.length > 1 ? 'S' : ''}: {flags.slice(0, 3).join(', ')}</small>}
        {latency != null && powered && <small className="voice-latency">FIRST AUDIO {latency} MS</small>}
      </div>
      <button
        type="button"
        className={orbClass}
        aria-label={!powered ? 'Turn on voice agent' : tier === 'ptt' ? 'Hold to talk' : 'Talk to the voice agent'}
        aria-pressed={powered}
        onClick={() => {
          if (!powered) { setOpen(true); return; }
          if (tier === 'ptt') return; // press-and-hold handled below
          if (mode === 'speaking' || (mode === 'thinking' && tier !== 'live')) { hardStop(); setCaption('Stopped · tap to talk'); return; }
          talk();
        }}
        onPointerDown={() => { if (powered && tierRef.current === 'ptt') void startPtt(); }}
        onPointerUp={() => { if (tierRef.current === 'ptt') void finishPtt(); }}
        onPointerLeave={() => { if (tierRef.current === 'ptt' && pttRef.current?.recording) void finishPtt(); }}
        onContextMenu={(event) => { event.preventDefault(); setOpen((v) => !v); }}
      >
        <ThinkingOrb
          size={64}
          theme="dark"
          state={
            !powered ? 'breathing' :
            mode === 'listening' ? 'listening' :
            mode === 'thinking' ? 'searching' :
            mode === 'speaking' ? 'composing' :
            'shaping'
          }
          color={
            !powered ? '#888888' :
            mode === 'listening' ? '#6fcf97' :
            mode === 'thinking' ? '#f2c94c' :
            mode === 'speaking' ? '#3d9ebd' :
            '#c45c26'
          }
          speed={mode === 'thinking' ? 1.5 : mode === 'listening' ? 1.2 : 1}
        />
        {(mode === 'listening' || mode === 'speaking') && <span className="voice-wave" aria-hidden>{bars.map((b, i) => <i key={i} style={{ transform: `scaleY(${Math.min(1, 0.15 + level * 9 * b)})` }} />)}</span>}
      </button>
      {powered && <button type="button" className="voice-globe-more" aria-label="Voice settings" onClick={() => setOpen((v) => !v)}>⋯</button>}
      {open && (
        <div className="voice-globe-pop" role="dialog" aria-label="Voice controls">
          <strong>VOICE AGENT</strong>
          <p>{powered
            ? tier === 'live' ? 'Live conversation: just talk, interrupt any time. Answers use NASA tools; every number is checked.'
              : tier === 'ptt' ? 'Hold V or the orb while you speak, release to send. Works in every modern browser.'
                : 'Offline: on-device speech recognition where the browser has it, browser voices for replies.'
            : 'Talk to Mars Explorer: ask questions, plan routes, open pages. Audio is never stored.'}</p>
          <div className="voice-globe-actions">
            {!powered ? <button type="button" onClick={() => void turnOn()}>TURN ON</button> : <button type="button" onClick={turnOff}>TURN OFF</button>}
            {powered && <button type="button" onClick={() => { hardStop(); setCaption('Stopped'); }}>STOP</button>}
            {powered && <button type="button" onClick={() => void handleRef.current('describe this screen')}>DESCRIBE SCREEN</button>}
          </div>
          <div className="voice-globe-lang" role="group" aria-label="Voice mode">
            {(['live', 'ptt', 'offline'] as Tier[]).map((t) => <button key={t} type="button" className={tier === t ? 'active' : ''} disabled={t !== 'offline' && (liveReason === 'offline' || liveReason === 'no-key')} onClick={() => switchTier(t)}>{TIER_LABEL[t]}</button>)}
          </div>
          <div className="voice-globe-lang" role="group" aria-label="Voice language">
            <button type="button" className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
            <button type="button" className={lang === 'bn' ? 'active' : ''} onClick={() => setLang('bn')}>বাংলা</button>
          </div>
          {error && <small role="alert" className="voice-error">{error}</small>}
          {heard && <small>Heard: {heard}</small>}
          {liveReason && <small>Live voice: {liveReason === 'offline' ? 'off in OFFLINE mode' : liveReason === 'no-key' ? 'needs a Gemini key on the API' : 'API unreachable'}.</small>}
          <form onSubmit={(event) => {
            event.preventDefault();
            const cmd = textCmd.trim();
            if (!cmd) return;
            setTextCmd('');
            void (async () => {
              if (!poweredRef.current) { setPoweredSafe(true); setTierSafe('offline'); await unlockAudio(); }
              if (tierRef.current === 'live' && liveRef.current) { liveRef.current.sendText(cmd); setHeard(cmd); return; }
              await handleRef.current(cmd);
            })();
          }}>
            <input value={textCmd} onChange={(event) => setTextCmd(event.target.value)} placeholder="Type: when is sunset at Jezero?" aria-label="Type a question or command" />
            <button type="submit">GO</button>
          </form>
          <small>Mic audio goes to the API only while voice is on and is never stored. Keys stay on the server.</small>
          <button type="button" className="voice-globe-close" onClick={() => setOpen(false)}>CLOSE</button>
        </div>
      )}
    </div>
  );
}
