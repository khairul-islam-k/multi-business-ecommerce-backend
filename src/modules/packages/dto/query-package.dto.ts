import { ApiPropertyOptional } from "@nestjs/swagger";
import { PackageStatus } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class QueryPackageDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ example: "" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: PackageStatus })
  @IsOptional()
  @IsEnum(PackageStatus)
  status?: PackageStatus;
}
