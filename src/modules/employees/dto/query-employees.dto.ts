import { ApiPropertyOptional } from "@nestjs/swagger";
import { SystemUserStatus } from "@prisma/client";
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

export class QueryEmployeesDto {
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

  @ApiPropertyOptional({ example: "john" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: SystemUserStatus,
    example: SystemUserStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(SystemUserStatus)
  status?: SystemUserStatus;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeDeleted?: boolean;

  @ApiPropertyOptional({
    enum: ["name", "email", "status", "createdAt", "updatedAt"],
    example: "createdAt",
  })
  @IsOptional()
  @IsIn(["name", "email", "status", "createdAt", "updatedAt"])
  sortBy?: "name" | "email" | "status" | "createdAt" | "updatedAt";

  @ApiPropertyOptional({
    enum: ["asc", "desc"],
    example: "desc",
  })
  @IsOptional()
  @IsIn(["asc", "desc"])
  sortOrder?: "asc" | "desc";
}
