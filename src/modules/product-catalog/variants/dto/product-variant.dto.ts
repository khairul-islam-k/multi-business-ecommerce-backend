import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

import { ProductVariantStatus } from "@/database/schema";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";

import { ProductImagesDto } from "../../common/dto/product-media.dto";

export class ProductVariantAttributeInputDto {
  @ApiProperty({ example: "3f8398d0-5bdb-4c9f-9c75-728c75b6bd2f" })
  @IsUUID()
  attributeId!: string;

  @ApiProperty({ example: "bd1eb78a-7e0c-4d55-8df7-2fda5316dd07" })
  @IsUUID()
  attributeValueId!: string;
}

export class CreateProductVariantDto extends ProductImagesDto {
  @ApiProperty({ example: "Red / XL" })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ example: 1250 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceOverride?: number;

  @ApiPropertyOptional({ example: 0.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional({ enum: ProductVariantStatus })
  @IsOptional()
  @IsEnum(ProductVariantStatus)
  status?: ProductVariantStatus;

  @ApiPropertyOptional({ type: [ProductVariantAttributeInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantAttributeInputDto)
  attributes?: ProductVariantAttributeInputDto[];
}

export class BulkCreateProductVariantsDto {
  @ApiProperty({ type: [CreateProductVariantDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants!: CreateProductVariantDto[];
}

export class UpdateProductVariantAttributesDto {
  @ApiProperty({ type: [ProductVariantAttributeInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantAttributeInputDto)
  attributes!: ProductVariantAttributeInputDto[];
}
export class UpdateProductVariantDto extends PartialType(
  CreateProductVariantDto,
) {}

export class BulkUpdateProductVariantItemDto extends UpdateProductVariantDto {
  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  variantId!: string;
}

export class BulkUpdateProductVariantsDto {
  @ApiProperty({ type: [BulkUpdateProductVariantItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BulkUpdateProductVariantItemDto)
  variants!: BulkUpdateProductVariantItemDto[];
}

export class ProductVariantOptionsDto {
  @ApiPropertyOptional({ type: [ProductVariantAttributeInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantAttributeInputDto)
  selectedAttributes?: ProductVariantAttributeInputDto[];

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  includeOutOfStock?: boolean;
}

export class QueryProductVariantDto {
  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({ example: "red" })
  @IsOptional()
  @IsString()
  search?: string;
}
