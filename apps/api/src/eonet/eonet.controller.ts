import { Controller, Get, Param, Query } from '@nestjs/common';
import { EonetQueryDto } from './dto/eonet-query.dto';
import { EonetService } from './eonet.service';

@Controller('eonet')
export class EonetController {
  constructor(private readonly eonet: EonetService) {}

  @Get('events/geojson')
  eventsGeoJson(@Query() query: EonetQueryDto) {
    return this.eonet.getEventsGeoJson(query);
  }

  @Get('events/:id')
  eventById(@Param('id') id: string) {
    return this.eonet.getEventById(id);
  }

  @Get('events')
  events(@Query() query: EonetQueryDto) {
    return this.eonet.getEvents(query);
  }

  @Get('events-summary')
  summary(@Query() query: EonetQueryDto) {
    return this.eonet.listEarthEventSummaries(query);
  }

  @Get('categories/:id')
  category(@Param('id') id: string, @Query() query: EonetQueryDto) {
    return this.eonet.getCategory(id, query);
  }

  @Get('categories')
  categories() {
    return this.eonet.getCategories();
  }

  @Get('sources')
  sources() {
    return this.eonet.getSources();
  }

  @Get('layers/:categoryId')
  layersByCategory(@Param('categoryId') categoryId: string) {
    return this.eonet.getLayersByCategory(categoryId);
  }

  @Get('layers')
  layers() {
    return this.eonet.getLayers();
  }

  @Get('magnitudes')
  magnitudes() {
    return this.eonet.getMagnitudes();
  }
}
