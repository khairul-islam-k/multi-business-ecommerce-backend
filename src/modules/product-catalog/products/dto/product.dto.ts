import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { CatalogProductStatus } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

import { ProductImagesDto } from "../../common/dto/product-media.dto";
import { CatalogSortOrder } from "../../common/dto/query-catalog.dto";

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

  @ApiPropertyOptional({ example: 0.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight?: number;

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
  unitId?: string;

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

export class QueryProductDto {
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

  @ApiPropertyOptional({ example: "sneaker" })
  @IsOptional()
  @IsString()
  search?: string;

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

  @ApiPropertyOptional({
    enum: CatalogSortOrder,
    example: CatalogSortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(CatalogSortOrder)
  sortOrder?: CatalogSortOrder = CatalogSortOrder.DESC;
}
