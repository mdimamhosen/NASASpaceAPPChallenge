import { Controller, Get, Query } from '@nestjs/common';
import { RegionsService } from './regions.service';

@Controller('regions')
export class RegionsController {
  constructor(private readonly regions: RegionsService) {}

  @Get('jezero')
  jezero(@Query('demo') demo?: string) {
    return this.regions.getJezero(demo === 'true');
  }
}
