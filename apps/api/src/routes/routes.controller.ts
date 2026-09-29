import { Body, Controller, Post } from '@nestjs/common';
import { AnalyzeRouteDto } from './dto/analyze-route.dto';
import { RoutesService } from './routes.service';

@Controller('routes')
export class RoutesController {
  constructor(private readonly routes: RoutesService) {}

  @Post('analyze')
  analyze(@Body() body: AnalyzeRouteDto) {
    return this.routes.analyze(body.waypoints);
  }
}
