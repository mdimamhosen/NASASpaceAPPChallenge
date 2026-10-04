import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { PlacesController } from './places.controller';
import { PlacesService } from './places.service';

@Module({ imports: [CommonModule], controllers: [PlacesController], providers: [PlacesService], exports: [PlacesService] })
export class PlacesModule {}
