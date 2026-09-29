import { Controller, Get } from '@nestjs/common';
import { LayersService } from './layers.service';

@Controller('layers')
export class LayersController {
  constructor(private readonly layers: LayersService) {}

  @Get()
  list() {
    return this.layers.getLayers();
  }
}
