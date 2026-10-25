import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { OpenDataModule } from '../opendata/opendata.module';
import { PlacesModule } from '../places/places.module';
import { RegionsModule } from '../regions/regions.module';
import { RoutesModule } from '../routes/routes.module';
import { BriefingsController } from './briefings.controller';
import { BriefingPdfService } from './briefing-pdf.service';
import { BriefingsService } from './briefings.service';

@Module({
  imports: [AgentModule, RoutesModule, OpenDataModule, RegionsModule, PlacesModule],
  controllers: [BriefingsController],
  providers: [BriefingsService, BriefingPdfService],
})
export class BriefingsModule {}
