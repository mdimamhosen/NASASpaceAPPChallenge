import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { PlacesService } from './places.service';

@Controller('places')
export class PlacesController {
  constructor(private readonly places: PlacesService) {}

  @Get('perseverance')
  perseverance(@Query('fromSol') from?: string, @Query('toSol') to?: string) {
    const { fromSol, toSol } = this.parse(from, to);
    return this.places.perseverance(fromSol, toSol);
  }

  @Get('curiosity')
  curiosity(@Query('fromSol') from?: string, @Query('toSol') to?: string) {
    const { fromSol, toSol } = this.parse(from, to);
    return this.places.curiosity(fromSol, toSol);
  }

  private parse(from?: string, to?: string) {
    const p = (value: string | undefined, fallback: number) => value === undefined ? fallback : Number(value);
    const fromSol = p(from, 0);
    const toSol = p(to, Number.MAX_SAFE_INTEGER);
    if (!Number.isInteger(fromSol) || !Number.isInteger(toSol) || fromSol < 0 || toSol < fromSol) {
      throw new BadRequestException('fromSol and toSol must be non-negative, ordered integers.');
    }
    return { fromSol, toSol };
  }
}
