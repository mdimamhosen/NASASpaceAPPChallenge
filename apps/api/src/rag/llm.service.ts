import { Injectable, Logger } from '@nestjs/common';
import { isOffline } from '../common/offline';
import Anthropic from '@anthropic-ai/sdk';

export type LlmProvider = 'gemini' | 'claude';
export type ToolSpec = { name: string; description: string; parameters: { type: 'object'; properties: Record<string, unknown>; required?: string[] } };
export type ToolCall = { id: string; name: string; args: Record<string, unknown> };

/** One turn of a provider-neutral tool loop: either tool calls to run or final text. */
export type AgentTurn = { text: string; calls: ToolCall[] };
/** Opaque per-provider conversation state, advanced by the provider's own message format. */
export type Conversation = { provider: LlmProvider; system: string; messages: unknown[] };

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Gemini first, Claude (official SDK) as fallback. Keys stay on the API.
 * Claude uses claude-opus-5-5 with server-side refusal fallbacks; RAG_CLAUDE_MODEL / RAG_GEMINI_MODEL override.
 */
@Injectable()
export class LlmService {
  private readonly log = new Logger(LlmService.name);
  readonly geminiModel = process.env.RAG_GEMINI_MODEL || 'gemini-2.5-flash';
  readonly claudeModel = process.env.RAG_CLAUDE_MODEL || 'claude-opus-5-5';
  private claudeClient?: Anthropic;

  private get geminiKey() { return process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY; }
  private get claudeKey() { return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY; }
  get providers(): LlmProvider[] { if (isOffline()) return []; return [...(this.geminiKey ? ['gemini' as const] : []), ...(this.claudeKey ? ['claude' as const] : [])]; }
  get status() { const p = this.providers; return { gemini: p.includes('gemini'), claude: p.includes('claude') }; }

  private get claude() { return (this.claudeClient ??= new Anthropic({ apiKey: this.claudeKey, maxRetries: 2, timeout: 90_000 })); }

  private async gemini(body: unknown): Promise<any> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`${GEMINI_BASE}/${this.geminiModel}:generateContent`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': this.geminiKey! }, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000),
      });
      if (res.ok) return res.json();
      // Gemini intermittently returns bodiless 404/5xx; retry those before falling back.
      if (res.status === 404 || res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 800 * (attempt + 1))); continue; }
      throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    throw new Error('Gemini unavailable after retries.');
  }

  private claudeText(message: Anthropic.Beta.BetaMessage): string {
    if (message.stop_reason === 'refusal') throw new Error('Claude declined the request.');
    return message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').trim();
  }

  /** Single grounded completion with provider fallback. Returns null when no provider succeeds. */
  async complete(system: string, user: string): Promise<{ text: string; provider: LlmProvider } | null> {
    for (const provider of this.providers) {
      const text = await this.completeWith(provider, system, user);
      if (text) return { text, provider };
    }
    return null;
  }

  /** Completion from one named provider; null when it is unconfigured or fails. */
  async completeWith(provider: LlmProvider, system: string, user: string): Promise<string | null> {
    if (!this.providers.includes(provider)) return null;
    try {
      if (provider === 'gemini') {
        const data = await this.gemini({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 4096 } });
        const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('').trim();
        if (text) return text;
      } else {
        const message = await this.claude.beta.messages.create({
          model: this.claudeModel, max_tokens: 16000, system, output_config: { effort: 'low' },
          betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
          messages: [{ role: 'user', content: user }],
        });
        const text = this.claudeText(message);
        if (text) return text;
      }
    } catch (error) {
      this.log.warn(`${provider} completion failed: ${(error as Error).message}`);
    }
    return null;
  }

  /**
   * Streamed completion, Gemini first then Claude. Falls back only if the provider fails before its first token,
   * so the caller never sees two providers' text mixed. Returns null when nothing could be streamed.
   */
  async stream(system: string, user: string, onDelta: (text: string) => void): Promise<{ text: string; provider: LlmProvider } | null> {
    for (const provider of this.providers) {
      let text = '';
      const emit = (d: string) => { if (d) { text += d; onDelta(d); } };
      try {
        if (provider === 'gemini') await this.geminiStream(system, user, emit);
        else {
          const stream = this.claude.beta.messages.stream({
            model: this.claudeModel, max_tokens: 16000, system, output_config: { effort: 'low' },
            betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
            messages: [{ role: 'user', content: user }],
          });
          stream.on('text', emit);
          const final = await stream.finalMessage();
          if (final.stop_reason === 'refusal') throw new Error('Claude declined the request.');
        }
        if (text.trim()) return { text: text.trim(), provider };
      } catch (error) {
        this.log.warn(`${provider} stream failed: ${(error as Error).message}`);
        if (text) throw error; // partial output already shown; let the caller reset
      }
    }
    return null;
  }

  private async geminiStream(system: string, user: string, emit: (d: string) => void) {
    let res: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(`${GEMINI_BASE}/${this.geminiModel}:streamGenerateContent?alt=sse`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': this.geminiKey! }, signal: AbortSignal.timeout(60_000),
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 4096 } }),
      });
      if (res.ok) break;
      if (res.status !== 404 && res.status !== 429 && res.status < 500) throw new Error(`Gemini HTTP ${res.status}`);
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
    if (!res?.ok || !res.body) throw new Error('Gemini stream unavailable.');
    const reader = res.body.getReader(), decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const chunk = JSON.parse(line.slice(5)) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> };
        for (const part of chunk.candidates?.[0]?.content?.parts ?? []) if (!part.thought) emit(part.text ?? '');
      }
    }
  }

  startConversation(provider: LlmProvider, system: string, goal: string): Conversation {
    return { provider, system, messages: provider === 'gemini' ? [{ role: 'user', parts: [{ text: goal }] }] : [{ role: 'user', content: goal }] };
  }

  /** Advance a tool-use conversation by one model turn. */
  async turn(conv: Conversation, tools: ToolSpec[]): Promise<AgentTurn> {
    if (conv.provider === 'gemini') {
      const data = await this.gemini({
        systemInstruction: { parts: [{ text: conv.system }] }, contents: conv.messages,
        // Gemini rejects empty object schemas, so parameterless tools omit `parameters`.
        tools: [{ functionDeclarations: tools.map((t) => (Object.keys(t.parameters.properties).length ? t : { name: t.name, description: t.description })) }], toolConfig: { functionCallingConfig: { mode: 'AUTO' } }, generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
      });
      const content = data.candidates?.[0]?.content;
      if (!content) throw new Error(`Gemini returned no content (${data.candidates?.[0]?.finishReason ?? data.promptFeedback?.blockReason ?? 'unknown'}).`);
      conv.messages.push(content);
      const parts: Array<{ text?: string; functionCall?: { name: string; args?: Record<string, unknown> } }> = content.parts ?? [];
      return {
        text: parts.map((p) => p.text ?? '').join('').trim(),
        calls: parts.filter((p) => p.functionCall).map((p, i) => ({ id: `g${conv.messages.length}-${i}`, name: p.functionCall!.name, args: p.functionCall!.args ?? {} })),
      };
    }
    const message = await this.claude.beta.messages.create({
      model: this.claudeModel, max_tokens: 16000, system: conv.system, output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })),
      messages: conv.messages as Anthropic.Beta.BetaMessageParam[],
    });
    if (message.stop_reason === 'refusal') throw new Error('Claude declined the request.');
    conv.messages.push({ role: 'assistant', content: message.content });
    return {
      text: message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').trim(),
      calls: message.content.flatMap((b) => (b.type === 'tool_use' ? [{ id: b.id, name: b.name, args: (b.input ?? {}) as Record<string, unknown> }] : [])),
    };
  }

  /** Return all tool results for one model turn in a single message (keeps parallel tool use working). */
  addToolResults(conv: Conversation, results: Array<{ call: ToolCall; output: unknown; isError?: boolean }>) {
    if (conv.provider === 'gemini') {
      conv.messages.push({ role: 'user', parts: results.map((r) => ({ functionResponse: { name: r.call.name, response: { result: r.output } } })) });
    } else {
      conv.messages.push({ role: 'user', content: results.map((r) => ({ type: 'tool_result', tool_use_id: r.call.id, content: JSON.stringify(r.output), is_error: r.isError ?? false })) });
    }
  }
}
