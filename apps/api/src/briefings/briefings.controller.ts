import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
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
    const [briefing, guide] = await Promise.all([this.briefings.create(body.waypoints), this.briefings.fieldGuide(body.waypoints)]);
    const file = await this.pdf.render(briefing, guide);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', 'attachment; filename=jezero-marswalk-field-guide.pdf');
    response.send(file);
  }

  @Post()
  create(@Body() body: BriefingDto) {
    return this.briefings.create(body.waypoints);
  }

  @Get('classroom-worksheet')
  async classroomWorksheet(@Query('lang') lang: string | undefined, @Res() response: Response) {
    const file = await this.pdf.classroomWorksheet(lang === 'bn' ? 'bn' : 'en');
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename=mars-explorer-classroom-${lang === 'bn' ? 'bn' : 'en'}.pdf`);
    response.send(file);
  }
}
