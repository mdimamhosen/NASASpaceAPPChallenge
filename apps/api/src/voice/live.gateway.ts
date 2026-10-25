import { Logger, OnModuleDestroy } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { isOffline } from '../common/offline';
import { MissionAgentService } from '../agent/mission-agent.service';
import { VOICE_LANGS, type VoiceLang } from './voice.service';

const LIVE_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const LIVE_MODELS = ['gemini-3.8-live', 'gemini-2.5-flash-native-audio-latest'];
const SESSION_CAP_MS = 8 * 60_000;
const MAX_SESSIONS = 12, MAX_PER_IP = 2, MAX_CHUNK = 64_000;
const LANG_NAMES: Record<VoiceLang, string> = { en: 'English', bn: 'Bangla', es: 'Spanish', fr: 'French', hi: 'Hindi' };

// Tools the browser executes: page navigation / map commands and reading what is on screen.
const CLIENT_TOOLS = [
  { name: 'ui_command', description: 'Run an app UI command in the browser: open a page (explore, timeline, survival, validation, research, classroom, eonet, science, opendata…), scrub the Explore map to a sol, show or hide HiRISE/IAU names/hardware layers, suggest corridor, analyze route, export GeoJSON or CSV, classroom mode. Pass the user\'s command words.', parameters: { type: 'object', properties: { command: { type: 'string', description: 'e.g. "open timeline", "sol 420", "show hirise", "export geojson"' } }, required: ['command'] } },
  { name: 'describe_screen', description: 'Read a short text summary of what is currently on the user\'s screen (page title, headings, key values). Use when the user asks what they are looking at.', parameters: { type: 'object', properties: {} } },
];

type Session = { ws: WebSocket; ip: string; timer: NodeJS.Timeout; userText: string; modelText: string; ready: boolean };

const system = (lang: VoiceLang) => [
  'You are the Mars Explorer voice assistant for NASA Space Apps (Jezero Crater, Perseverance, Marswalk survival).',
  `Speak ${LANG_NAMES[lang]}. Keep answers to one to three short spoken sentences.`,
  'Round coordinates to 4 decimals and other values to at most 2 significant decimals. Every number you say must come from a tool result in this conversation. If no tool gives a number, say you do not have a sourced value.',
  'Use rover_position or verified_locations for coordinates, mars_time for local time and daylight, comm_window for blackouts, eva_budget for Marswalk time and radiation.',
  'Use ui_command for navigation and map commands, then confirm in a few words. Use describe_screen when asked what is on screen.',
  'Routes, Risk Index and EVA budgets are non-certifying research aids; say so when you give them. EONET is Earth-only and never describes Mars.',
].join(' ');

/**
 * Tier 1 voice: relays browser PCM audio to Gemini Live so the API key stays on the server. Gemini's function calls run
 * through MissionAgentService (same validation as the agent), and the spoken answer is checked by the provenance gate.
 * Audio is relayed, never stored.
 */
@WebSocketGateway({ namespace: 'voice-live', cors: { origin: process.env.WEB_ORIGIN || 'http://localhost:3000' }, maxHttpBufferSize: 256_000 })
export class LiveGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  private readonly log = new Logger(LiveGateway.name);
  private readonly sessions = new Map<string, Session>();
  constructor(private readonly agent: MissionAgentService) {}

  private get key() { return process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY; }

  handleConnection(client: Socket) {
    const reason = isOffline() ? 'offline' : !this.key ? 'no-key' : null;
    client.emit('live.status', { available: !reason, reason });
  }

  handleDisconnect(client: Socket) { this.end(client.id); }
  onModuleDestroy() { [...this.sessions.keys()].forEach((id) => this.end(id)); }

  @SubscribeMessage('start')
  start(@ConnectedSocket() client: Socket, @MessageBody() body: { lang?: string } = {}) {
    if (isOffline() || !this.key) return client.emit('live.error', { code: 'unavailable', message: 'Live voice needs the network and a Gemini key on the API.' });
    const ip = client.handshake.address;
    if (this.sessions.size >= MAX_SESSIONS || [...this.sessions.values()].filter((s) => s.ip === ip).length >= MAX_PER_IP) return client.emit('live.error', { code: 'busy', message: 'Too many live voice sessions. Use push-to-talk.' });
    this.end(client.id);
    const lang = (VOICE_LANGS as readonly string[]).includes(body.lang ?? '') ? (body.lang as VoiceLang) : 'en';
    this.open(client, lang, 0, ip);
  }

  private open(client: Socket, lang: VoiceLang, modelIndex: number, ip: string) {
    const model = LIVE_MODELS[modelIndex];
    const tools = this.agent.voiceSession(lang === 'bn' ? 'bn' : 'en', (e) => { if (e.type === 'step') client.emit('live.step', e.data); });
    const ws = new WebSocket(`${LIVE_URL}?key=${this.key}`);
    const session: Session = { ws, ip, userText: '', modelText: '', ready: false, timer: setTimeout(() => { client.emit('live.ended', { reason: 'cap', message: 'Live sessions end after 8 minutes. Tap to start again.' }); this.end(client.id); }, SESSION_CAP_MS) };
    this.sessions.set(client.id, session);

    ws.onopen = () => ws.send(JSON.stringify({ setup: {
      model: `models/${model}`,
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: lang === 'en' ? 'Aoede' : 'Kore' } } } },
      systemInstruction: { parts: [{ text: system(lang) }] },
      tools: [{ functionDeclarations: [...tools.tools, ...CLIENT_TOOLS] }],
      inputAudioTranscription: {}, outputAudioTranscription: {},
    } }));

    ws.onmessage = async (m) => {
      const msg = JSON.parse(typeof m.data === 'string' ? m.data : Buffer.from(await (m.data as Blob).arrayBuffer()).toString());
      if (msg.setupComplete) { session.ready = true; client.emit('live.ready', { model }); return; }
      if (msg.toolCall) {
        const responses = await Promise.all((msg.toolCall.functionCalls ?? []).map(async (c: { id: string; name: string; args?: Record<string, unknown> }) => {
          if (CLIENT_TOOLS.some((t) => t.name === c.name)) {
            const result = await client.timeout(5000).emitWithAck('live.clientTool', { name: c.name, args: c.args ?? {} }).catch(() => ({ error: 'the browser did not answer' }));
            return { id: c.id, name: c.name, response: { result } };
          }
          return { id: c.id, name: c.name, response: { result: await tools.run(c.name, c.args ?? {}) } };
        }));
        const route = tools.route();
        if (route?.length) client.emit('live.route', route);
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ toolResponse: { functionResponses: responses } }));
        return;
      }
      const sc = msg.serverContent;
      if (!sc) return;
      if (sc.inputTranscription?.text) { session.userText += sc.inputTranscription.text; client.emit('live.caption', { role: 'user', text: session.userText }); }
      if (sc.outputTranscription?.text) { session.modelText += sc.outputTranscription.text; client.emit('live.caption', { role: 'model', text: session.modelText }); }
      for (const p of sc.modelTurn?.parts ?? []) if (p.inlineData?.data) client.emit('live.audio', Buffer.from(p.inlineData.data, 'base64'));
      if (sc.interrupted) client.emit('live.interrupted');
      if (sc.turnComplete && session.modelText.trim()) {
        const provenance = tools.provenance(session.modelText, session.userText);
        client.emit('live.turn', { user: session.userText.trim(), text: session.modelText.trim(), provenance });
        session.userText = ''; session.modelText = '';
      }
    };
    ws.onclose = (e) => {
      if (this.sessions.get(client.id)?.ws !== ws) return;
      // Setup rejected (model unavailable): try the next Live model once.
      if (!session.ready && modelIndex + 1 < LIVE_MODELS.length) { this.log.warn(`Live ${model} closed before setup (${e.code} ${e.reason}); trying ${LIVE_MODELS[modelIndex + 1]}`); clearTimeout(session.timer); this.sessions.delete(client.id); this.open(client, lang, modelIndex + 1, ip); return; }
      client.emit('live.ended', { reason: session.ready ? 'closed' : 'setup-failed', message: e.reason || `Live connection closed (${e.code}).` });
      this.end(client.id);
    };
    ws.onerror = () => this.log.warn(`Live ${model} socket error`);
  }

  @SubscribeMessage('audio')
  audio(@ConnectedSocket() client: Socket, @MessageBody() chunk: Buffer) {
    const s = this.sessions.get(client.id);
    if (!s?.ready || !Buffer.isBuffer(chunk) || chunk.length > MAX_CHUNK || s.ws.readyState !== WebSocket.OPEN) return;
    s.ws.send(JSON.stringify({ realtimeInput: { audio: { data: chunk.toString('base64'), mimeType: 'audio/pcm;rate=16000' } } }));
  }

  @SubscribeMessage('text')
  text(@ConnectedSocket() client: Socket, @MessageBody() body: { text?: string }) {
    const s = this.sessions.get(client.id), text = String(body?.text ?? '').slice(0, 500).trim();
    if (!s?.ready || !text || s.ws.readyState !== WebSocket.OPEN) return;
    s.userText = text;
    s.ws.send(JSON.stringify({ realtimeInput: { text } }));
  }

  @SubscribeMessage('stop')
  stop(@ConnectedSocket() client: Socket) { this.end(client.id); }

  private end(id: string) {
    const s = this.sessions.get(id);
    if (!s) return;
    this.sessions.delete(id);
    clearTimeout(s.timer);
    try { s.ws.close(); } catch { /* already closed */ }
  }
}
