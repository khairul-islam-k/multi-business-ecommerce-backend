import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";

import { CatalogProductStatus } from "@/database/schema";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";

import { SortedPaginationQueryDto } from "../../../../common/http/query.dto";
import { ProductImagesDto } from "../../common/dto/product-media.dto";

export const ProductSortBy = {
  NAME: "name",
  PRICE: "price",
  CREATED_AT: "createdAt",
  UPDATED_AT: "updatedAt",
} as const;
export type ProductSortBy = (typeof ProductSortBy)[keyof typeof ProductSortBy];

export class CreateProductDto extends ProductImagesDto {
  @ApiProperty({ example: "Classic sneaker" })
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: "Comfortable everyday sneaker" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 1200 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiProperty({ example: 0.5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  weight!: number;

  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  brandId!: string;

  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  unitId!: string;

  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  taxId!: string;

  @ApiPropertyOptional({ enum: CatalogProductStatus })
  @IsOptional()
  @IsEnum(CatalogProductStatus)
  status?: CatalogProductStatus;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  tagIds?: string[];
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class QueryProductDto extends SortedPaginationQueryDto<ProductSortBy> {
  @ApiPropertyOptional({ enum: CatalogProductStatus })
  @IsOptional()
  @IsEnum(CatalogProductStatus)
  status?: CatalogProductStatus;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  tagId?: string;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({
    enum: ProductSortBy,
    example: ProductSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsIn(Object.values(ProductSortBy))
  sortBy?: ProductSortBy = ProductSortBy.CREATED_AT;
}
