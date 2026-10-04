import { Module } from '@nestjs/common';
import { RoutesController } from './routes.controller';
import { RegionsModule } from '../regions/regions.module';
import { DtmService } from './dtm.service';
import { RoutesService } from './routes.service';

@Module({
  imports: [RegionsModule],
  controllers: [RoutesController],
  providers: [RoutesService, DtmService],
  exports: [RoutesService],
})
export class RoutesModule {}
