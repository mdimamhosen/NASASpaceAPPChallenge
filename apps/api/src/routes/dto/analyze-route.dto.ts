import { IsArray, ArrayMaxSize, ArrayMinSize, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { RouteWaypoint } from '@mars-explorer/shared';

export class WaypointDto implements RouteWaypoint {
  @IsNumber() lat!: number;
  @IsNumber() lon!: number;
  @IsString() id!: string;
}

export class AnalyzeRouteDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => WaypointDto)
  waypoints!: WaypointDto[];
}
