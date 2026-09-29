import { Module } from '@nestjs/common';
import { RegionsModule } from '../regions/regions.module';
import { RoutesController } from './routes.controller';
import { JezeroSpatialService } from './jezero-spatial.service';
import { RoutesService } from './routes.service';

@Module({
  imports: [RegionsModule],
  controllers: [RoutesController],
  providers: [RoutesService, JezeroSpatialService],
  exports: [RoutesService],
})
export class RoutesModule {}
