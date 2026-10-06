import { Body, Controller, Get, MessageEvent, Post, Query, Sse } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { Observable } from 'rxjs';
import { Throttle } from '@nestjs/throttler';
import { MissionAgentService } from './mission-agent.service';

class RunDto {
  @IsString() @MinLength(3) @MaxLength(500) goal!: string;
  @IsOptional() @Transform(({ value }) => value === true || value === 'true' || value === '1') @IsBoolean() cloud = true;
  @IsOptional() @IsIn(['fast', 'deep']) mode: 'fast' | 'deep' = 'fast';
  @IsOptional() @IsIn(['en', 'bn']) lang: 'en' | 'bn' = 'en';
}

@Controller('agent')
export class AgentController {
  constructor(private readonly agent: MissionAgentService) {}

  /** Whole run in one response. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('run')
  run(@Body() body: RunDto) { return this.agent.run(body.goal, { cloud: body.cloud, mode: body.mode, lang: body.lang }); }

  /** Server-sent events: `step` per plan/tool/answer, `token` deltas of the streamed answer, `reset`, then `done`. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Sse('stream')
  stream(@Query() query: RunDto): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      this.agent
        .run(query.goal, { cloud: query.cloud, mode: query.mode, lang: query.lang }, (e) => subscriber.next(e.type === 'reset' ? { type: 'reset', data: '' } : { type: e.type, data: e.data }))
        .then((run) => { subscriber.next({ type: 'done', data: run }); subscriber.complete(); })
        .catch((error: Error) => { subscriber.next({ type: 'failed', data: { message: error.message } }); subscriber.complete(); });
    });
  }

  @Get('tools')
  tools() { return this.agent.toolCatalog(); }
}
