import { ApiPropertyOptional } from "@nestjs/swagger";
import { CommonStatus } from "@/database/schema";
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

export class QueryRoleDto {
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

  @ApiPropertyOptional({ example: "manager" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: CommonStatus,
    example: CommonStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(CommonStatus)
  status?: CommonStatus;

  @ApiPropertyOptional({
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeDeleted?: boolean;

  @ApiPropertyOptional({
    enum: ["name", "status", "createdAt", "updatedAt"],
    example: "createdAt",
  })
  @IsOptional()
  @IsIn(["name", "status", "createdAt", "updatedAt"])
  sortBy?: "name" | "status" | "createdAt" | "updatedAt";

  @ApiPropertyOptional({
    enum: ["asc", "desc"],
    example: "desc",
  })
  @IsOptional()
  @IsIn(["asc", "desc"])
  sortOrder?: "asc" | "desc";
}
