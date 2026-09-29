import { Body, Controller, Get, Post } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsBoolean, IsNumber, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { RouteWaypoint } from '@mars-explorer/shared';
import { AssistantService } from './assistant.service';

class WaypointInput implements RouteWaypoint {
  @IsNumber() lat!: number;
  @IsNumber() lon!: number;
  @IsString() id!: string;
}

class AskDto {
  @IsString()
  @MinLength(3)
  question!: string;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => WaypointInput)
  waypoints: WaypointInput[] = [];

  @IsOptional()
  @IsBoolean()
  compareModels = false;

  @IsOptional()
  @IsBoolean()
  useCloudModels = false;
}

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Get('traces')
  traces() { return this.assistant.getTrace(); }

  @Post('ask')
  ask(@Body() body: AskDto) {
    return this.assistant.ask(body.question, body.waypoints, body.useCloudModels, body.compareModels);
  }
}
