import { BadRequestException, Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { OpenDataService } from './opendata.service';

class CatalogQuery {
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsString() @MaxLength(40) mission?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(5000) offset?: number;
  @IsOptional() @IsIn(['snapshot', 'live']) source?: 'snapshot' | 'live';
}

class BoxQuery {
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) south!: number;
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) north!: number;
  @Type(() => Number) @IsNumber() @Min(-540) @Max(540) west!: number;
  @Type(() => Number) @IsNumber() @Min(-540) @Max(540) east!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(12) zoom?: number;
}

class NearQuery {
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) lat!: number;
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180) lon!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(25) limit?: number;
}

/** Leaflet can report longitudes beyond ±180 after panning; fold them back and treat a full-width view as global. */
function normalizeBox({ south, north, west, east }: BoxQuery) {
  if (south > north) throw new BadRequestException('south must be ≤ north');
  if (east - west >= 360) return { south, north, west: -180, east: 180 };
  const fold = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;
  return { south, north, west: fold(west), east: fold(east) };
}

@Controller('opendata')
export class OpenDataController {
  constructor(private readonly openData: OpenDataService) {}

  @Get('catalog')
  catalog(@Query() q: CatalogQuery) {
    return this.openData.catalog(q.q?.trim() ?? '', q.mission?.toUpperCase(), q.limit ?? 24, q.offset ?? 0, q.source ?? 'snapshot');
  }

  @Get('catalog/:id')
  async dataset(@Param('id') id: string) {
    if (!/^[a-z0-9-]{3,120}$/.test(id)) throw new BadRequestException('invalid dataset id');
    const found = await this.openData.dataset(id);
    if (!found) throw new NotFoundException('dataset not in the data.nasa.gov Mars snapshot');
    return found;
  }

  @Get('features')
  features(@Query() q: BoxQuery) { return this.openData.features(normalizeBox(q), q.zoom ?? 5); }

  @Get('features/near')
  near(@Query() q: NearQuery) { return this.openData.nearestFeatures({ lat: q.lat, lon: q.lon }, q.limit ?? 8); }

  @Get('hirise-dtm')
  dtms(@Query() q: BoxQuery) { return this.openData.dtms(normalizeBox(q)); }

  @Get('landings')
  landings() { return this.openData.landings(); }

  @Get('hardware')
  hardware() { return this.openData.hardware(); }

  @Get('products')
  products() { return this.openData.products(); }
}
