import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from "class-validator";

import { WarehouseStatus } from "@/database/schema";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";

import { SortedPaginationQueryDto } from "../../../../common/http/query.dto";

export const WarehouseSortBy = {
  NAME: "name",
  STATUS: "status",
  CREATED_AT: "createdAt",
  UPDATED_AT: "updatedAt",
} as const;
export type WarehouseSortBy =
  (typeof WarehouseSortBy)[keyof typeof WarehouseSortBy];

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

export class QueryWarehouseDto extends SortedPaginationQueryDto<WarehouseSortBy> {
  @ApiPropertyOptional({ enum: WarehouseStatus })
  @IsOptional()
  @IsEnum(WarehouseStatus)
  status?: WarehouseStatus;

  @ApiPropertyOptional({
    enum: WarehouseSortBy,
    example: WarehouseSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsIn(Object.values(WarehouseSortBy))
  sortBy?: WarehouseSortBy = WarehouseSortBy.CREATED_AT;
}
