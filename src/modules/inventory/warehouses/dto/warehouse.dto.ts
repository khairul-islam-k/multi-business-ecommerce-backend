import { Type } from "class-transformer";
import {
  IsEnum,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { WarehouseStatus } from "@prisma/client";

import { CatalogSortOrder } from "../../../product-catalog/common/dto/query-catalog.dto";

export class CreateWarehouseDto {
  @ApiProperty({ example: "Main warehouse" })
  @IsString()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ example: "+8801700000000" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: "House 10, Road 2, Dhaka" })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ enum: WarehouseStatus })
  @IsOptional()
  @IsEnum(WarehouseStatus)
  status?: WarehouseStatus;
}

export class UpdateWarehouseDto extends PartialType(CreateWarehouseDto) {}

export class QueryWarehouseDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ example: "main" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: WarehouseStatus })
  @IsOptional()
  @IsEnum(WarehouseStatus)
  status?: WarehouseStatus;

  @ApiPropertyOptional({
    enum: CatalogSortOrder,
    example: CatalogSortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(CatalogSortOrder)
  sortOrder?: CatalogSortOrder = CatalogSortOrder.DESC;
}
