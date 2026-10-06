import { Module } from '@nestjs/common';
import { OpenDataController } from './opendata.controller';
import { OpenDataService } from './opendata.service';

@Module({ controllers: [OpenDataController], providers: [OpenDataService], exports: [OpenDataService] })
export class OpenDataModule {}
