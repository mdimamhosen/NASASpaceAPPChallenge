import { Module } from '@nestjs/common';
import { EonetModule } from '../eonet/eonet.module';
import { RagModule } from '../rag/rag.module';
import { RoutesModule } from '../routes/routes.module';
import { AssistantController } from './assistant.controller';
import { TraceStoreService } from './trace-store.service';
import { AssistantService } from './assistant.service';

@Module({
  imports: [RagModule, RoutesModule, EonetModule],
  controllers: [AssistantController],
  providers: [AssistantService, TraceStoreService],
  exports: [AssistantService],
})
export class AgentModule {}
