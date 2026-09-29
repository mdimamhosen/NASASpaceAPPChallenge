import { Body, Controller, Post, Res } from '@nestjs/common';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { Response } from 'express';
import { BriefingPdfService } from './briefing-pdf.service';
import type { RouteWaypoint } from '@mars-explorer/shared';
import { BriefingsService } from './briefings.service';

class WaypointInput implements RouteWaypoint {
  @IsNumber() lat!: number;
  @IsNumber() lon!: number;
  @IsString() id!: string;
}

class BriefingDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => WaypointInput)
  waypoints!: WaypointInput[];
}

@Controller('briefings')
export class BriefingsController {
  constructor(private readonly briefings: BriefingsService, private readonly pdf: BriefingPdfService) {}

  @Post('pdf')
  async downloadPdf(@Body() body: BriefingDto, @Res() response: Response) {
    const briefing = await this.briefings.create(body.waypoints);
    const file = await this.pdf.render(briefing);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', 'attachment; filename=jezero-marswalk-briefing.pdf');
    response.send(file);
  }

  @Post()
  create(@Body() body: BriefingDto) {
    return this.briefings.create(body.waypoints);
  }
}
