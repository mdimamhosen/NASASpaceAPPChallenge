import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { BriefingsController } from './briefings.controller';
import { BriefingPdfService } from './briefing-pdf.service';
import { BriefingsService } from './briefings.service';

@Module({
  imports: [AgentModule],
  controllers: [BriefingsController],
  providers: [BriefingsService, BriefingPdfService],
})
export class BriefingsModule {}
