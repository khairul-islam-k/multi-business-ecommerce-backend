import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { InventoryAdjustmentType } from "@/database/schema";
import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

export class StockAdjustmentItemDto {
  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  adjustmentQty!: number;

  @ApiPropertyOptional({ example: "Opening stock" })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateStockAdjustmentDto {
  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  warehouseId!: string;

  @ApiProperty({ enum: InventoryAdjustmentType })
  @IsEnum(InventoryAdjustmentType)
  adjustmentType!: InventoryAdjustmentType;

  @ApiPropertyOptional({ example: "Cycle count correction" })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ type: [StockAdjustmentItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockAdjustmentItemDto)
  items!: StockAdjustmentItemDto[];
}

export class QueryStockAdjustmentDto {
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

  @ApiPropertyOptional({ example: "ADJ" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}
