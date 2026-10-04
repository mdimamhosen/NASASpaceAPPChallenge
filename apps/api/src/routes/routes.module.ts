import { Module } from '@nestjs/common';
import { RoutesController } from './routes.controller';
import { DtmService } from './dtm.service';
import { RoutesService } from './routes.service';

@Module({
  controllers: [RoutesController],
  providers: [RoutesService, DtmService],
  exports: [RoutesService],
})
export class RoutesModule {}
