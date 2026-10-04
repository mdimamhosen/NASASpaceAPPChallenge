import { Body, Controller, Get, Post } from '@nestjs/common';
import { AnalyzeRouteDto } from './dto/analyze-route.dto';
import { RoutesService } from './routes.service';

@Controller('routes')
export class RoutesController {
  constructor(private readonly routes: RoutesService) {}

  @Get('dtm-grid')
  dtmGrid() { return this.routes.dtmGrid(); }

  @Post('suggest')
  suggest(@Body() body: AnalyzeRouteDto) { return this.routes.suggest(body.waypoints); }

  @Post('analyze')
  analyze(@Body() body: AnalyzeRouteDto) {
    return this.routes.analyze(body.waypoints);
  }
}
