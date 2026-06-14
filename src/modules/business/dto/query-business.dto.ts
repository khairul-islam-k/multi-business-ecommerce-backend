import { ApiPropertyOptional } from "@nestjs/swagger";
import { BusinessStatus } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class QueryBusinessDto {
  @ApiPropertyOptional({ example: "business" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: BusinessStatus })
  @IsOptional()
  @IsEnum(BusinessStatus)
  status?: BusinessStatus;

  @ApiPropertyOptional({ example: "BDT" })
  @IsOptional()
  @IsString()
  currencyCode?: string;

  @ApiPropertyOptional({ example: "Bangladesh" })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    example: "createdAt",
    enum: ["id", "name", "status", "createdAt", "updatedAt"],
  })
  @IsOptional()
  @IsIn(["id", "name", "status", "createdAt", "updatedAt"])
  sortBy?: "id" | "name" | "status" | "createdAt" | "updatedAt" = "createdAt";

  @ApiPropertyOptional({
    example: "desc",
    enum: ["asc", "desc"],
  })
  @IsOptional()
  @IsIn(["asc", "desc"])
  sortOrder?: "asc" | "desc" = "desc";

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeDeleted?: boolean = false;
}
