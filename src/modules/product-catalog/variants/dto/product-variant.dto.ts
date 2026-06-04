import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { ProductVariantStatus } from "@prisma/client";
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

export class QueryProductVariantDto {
  @ApiPropertyOptional({ example: "red" })
  @IsOptional()
  @IsString()
  search?: string;
}
