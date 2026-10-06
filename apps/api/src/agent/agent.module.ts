import { Module } from '@nestjs/common';
import { EonetModule } from '../eonet/eonet.module';
import { RagModule } from '../rag/rag.module';
import { RoutesModule } from '../routes/routes.module';
import { AssistantController } from './assistant.controller';
import { AgentController } from './agent.controller';
import { MissionAgentService } from './mission-agent.service';
import { JevRouterService } from './jev-router.service';
import { PlacesModule } from '../places/places.module';
import { RegionsModule } from '../regions/regions.module';
import { OpenDataModule } from '../opendata/opendata.module';
import { TraceStoreService } from './trace-store.service';
import { AssistantService } from './assistant.service';

@Module({
  imports: [RagModule, RoutesModule, EonetModule, PlacesModule, RegionsModule, OpenDataModule],
  controllers: [AssistantController, AgentController],
  providers: [AssistantService, TraceStoreService, MissionAgentService, JevRouterService],
  exports: [AssistantService],
})
export class AgentModule {}
