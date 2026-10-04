import { Module } from '@nestjs/common';
import { PlacesModule } from '../places/places.module';
import { RegionsController } from './regions.controller';
import { RegionsService } from './regions.service';

@Module({ imports: [PlacesModule], controllers: [RegionsController], providers: [RegionsService], exports: [RegionsService] })
export class RegionsModule {}
