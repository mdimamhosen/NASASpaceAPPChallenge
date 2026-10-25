import { Module } from '@nestjs/common';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';
import { LiveGateway } from './live.gateway';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [AgentModule],
  controllers: [VoiceController],
  providers: [VoiceService, LiveGateway],
  exports: [VoiceService],
})
export class VoiceModule {}
