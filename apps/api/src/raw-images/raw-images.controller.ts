import { Controller, Get, Query } from '@nestjs/common';
import { RawImagesService } from './raw-images.service';

@Controller('raw-images')
export class RawImagesController {
  constructor(private readonly raw: RawImagesService) {}

  @Get('perseverance')
  perseverance(@Query('sol') sol = '0', @Query('limit') limit = '12') {
    return this.raw.forSol(Number(sol), Number(limit));
  }
}
