import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { PlacesService } from './places.service';

@Controller('places')
export class PlacesController {
  constructor(private readonly places: PlacesService) {}

  @Get('perseverance')
  perseverance(@Query('fromSol') from?: string, @Query('toSol') to?: string) {
    const parse = (value: string | undefined, fallback: number) => value === undefined ? fallback : Number(value);
    const fromSol = parse(from, 0);
    const toSol = parse(to, Number.MAX_SAFE_INTEGER);
    if (!Number.isInteger(fromSol) || !Number.isInteger(toSol) || fromSol < 0 || toSol < fromSol) {
      throw new BadRequestException('fromSol and toSol must be non-negative, ordered integers.');
    }
    return this.places.perseverance(fromSol, toSol);
  }
}
