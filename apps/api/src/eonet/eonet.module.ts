import { Module } from '@nestjs/common';
import { EonetController } from './eonet.controller';
import { EonetService } from './eonet.service';

@Module({ controllers: [EonetController], providers: [EonetService], exports: [EonetService] })
export class EonetModule {}
