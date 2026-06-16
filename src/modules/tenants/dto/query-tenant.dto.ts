import { ApiPropertyOptional } from "@nestjs/swagger";
import { SystemUserStatus } from "@/database/schema";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class QueryTenantDto {
  @ApiPropertyOptional({ example: "" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: SystemUserStatus })
  @IsOptional()
  @IsEnum(SystemUserStatus)
  status?: SystemUserStatus;

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
}
