import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { VOICE_LANGS, VoiceService, type VoiceLang } from './voice.service';

class SpeakDto {
  @IsString() @MinLength(1) @MaxLength(800) text!: string;
  @IsOptional() @IsIn([...VOICE_LANGS]) lang: VoiceLang = 'en';
}

class TranscribeDto {
  /** Base64 audio, at most ~30 s of opus/webm or ~10 s of 16 kHz WAV. */
  @IsString() @MinLength(100) @MaxLength(420_000) audio!: string;
  @IsString() @Matches(/^audio\/[a-z0-9.+-]+(;\s*codecs=[a-z0-9.,"-]+)?$/i) mime!: string;
  @IsOptional() @IsIn([...VOICE_LANGS]) lang: VoiceLang = 'en';
}

@Controller('voice')
export class VoiceController {
  constructor(private readonly voice: VoiceService) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('speak')
  async speak(@Body() body: SpeakDto, @Res() response: Response) {
    const result = await this.voice.speak(body.text, body.lang ?? 'en');
    if (!result) {
      response.status(204).send();
      return;
    }
    response.status(200);
    response.setHeader('Content-Type', result.mime);
    response.setHeader('X-Voice-Source', result.source);
    response.send(result.buffer);
  }

  /** Streaming TTS as raw PCM16 24 kHz chunks; 204 means speak with the browser instead. */
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('speak/stream')
  async speakStream(@Body() body: SpeakDto, @Req() request: Request, @Res() response: Response) {
    const abort = new AbortController();
    request.on('close', () => abort.abort());
    const stream = await this.voice.speakStream(body.text, body.lang ?? 'en', abort.signal);
    if (!stream) { response.status(204).send(); return; }
    response.status(200);
    response.setHeader('Content-Type', 'audio/L16;rate=24000;channels=1');
    response.setHeader('X-Voice-Source', 'gemini-stream');
    try {
      for await (const chunk of stream) { if (abort.signal.aborted) break; response.write(chunk); }
    } catch (error) {
      if (!abort.signal.aborted) response.destroy(error as Error);
      return;
    }
    response.end();
  }

  /** Push-to-talk STT. `{ text: null }` means use on-device recognition or typed input (offline or no key). */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('transcribe')
  @HttpCode(200)
  async transcribe(@Body() body: TranscribeDto) {
    const result = await this.voice.transcribe(body.audio, body.mime.split(';')[0], body.lang ?? 'en');
    return result ?? { text: null, model: null, ms: 0 };
  }
}
