import { Type } from "class-transformer";
import { IsDateString, IsInt, IsOptional, Max, Min } from "class-validator";

import { ApiPropertyOptional } from "@nestjs/swagger";

export class OverviewQueryDto {
  @ApiPropertyOptional({ example: "2026-06-01T00:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: "2026-07-08T23:59:59.999Z" })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ example: 30, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number = 30;
}
