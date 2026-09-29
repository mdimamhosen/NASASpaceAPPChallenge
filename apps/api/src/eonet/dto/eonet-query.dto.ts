import { IsNumberString, IsOptional, IsString } from 'class-validator';

/** Query filters matching EONET v3 Events / GeoJSON / Categories APIs. */
export class EonetQueryDto {
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsNumberString() limit?: string;
  @IsOptional() @IsNumberString() days?: string;
  @IsOptional() @IsString() start?: string;
  @IsOptional() @IsString() end?: string;
  @IsOptional() @IsString() magID?: string;
  @IsOptional() @IsNumberString() magMin?: string;
  @IsOptional() @IsNumberString() magMax?: string;
  @IsOptional() @IsString() bbox?: string;
}
