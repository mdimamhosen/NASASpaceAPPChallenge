import { Module } from '@nestjs/common';
import { PlacesModule } from '../places/places.module';
import { OpenDataController } from './opendata.controller';
import { OpenDataService } from './opendata.service';

@Module({ imports: [PlacesModule], controllers: [OpenDataController], providers: [OpenDataService], exports: [OpenDataService] })
export class OpenDataModule {}
