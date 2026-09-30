import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { EonetController } from './eonet.controller';
import { EonetDurableStore } from './eonet-durable.store';
import { EonetService } from './eonet.service';

@Module({
  imports: [CommonModule],
  controllers: [EonetController],
  providers: [EonetDurableStore, EonetService],
  exports: [EonetService],
})
export class EonetModule {}
