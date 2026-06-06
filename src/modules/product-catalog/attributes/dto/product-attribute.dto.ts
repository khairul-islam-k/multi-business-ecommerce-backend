import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { ProductSimpleStatus } from "@prisma/client";
import { CatalogSortOrder } from "../../common/dto/query-catalog.dto";

export class CreateProductAttributeValueDto {
  @ApiProperty({ example: "Red" })
  @IsString()
  @MaxLength(150)
  value!: string;
}

export class UpdateProductAttributeValueDto extends PartialType(
  CreateProductAttributeValueDto,
) {}

export class ProductAttributeBaseDto {
  @ApiProperty({ example: "Color" })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ enum: ProductSimpleStatus })
  @IsOptional()
  @IsEnum(ProductSimpleStatus)
  status?: ProductSimpleStatus;
}

export class CreateProductAttributeDto extends ProductAttributeBaseDto {
  @ApiPropertyOptional({ type: [CreateProductAttributeValueDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateProductAttributeValueDto)
  values?: CreateProductAttributeValueDto[];
}

export class UpdateProductAttributeDto extends PartialType(
  ProductAttributeBaseDto,
) {}

export enum ProductAttributeSortBy {
  NAME = "name",
  CREATED_AT = "createdAt",
}

export class QueryProductAttributeDto {
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

  @ApiPropertyOptional({ example: "color" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ProductSimpleStatus })
  @IsOptional()
  @IsEnum(ProductSimpleStatus)
  status?: ProductSimpleStatus;

  @ApiPropertyOptional({
    enum: ProductAttributeSortBy,
    example: ProductAttributeSortBy.NAME,
  })
  @IsOptional()
  @IsEnum(ProductAttributeSortBy)
  sortBy?: ProductAttributeSortBy = ProductAttributeSortBy.NAME;

  @ApiPropertyOptional({
    enum: CatalogSortOrder,
    example: CatalogSortOrder.ASC,
  })
  @IsOptional()
  @IsEnum(CatalogSortOrder)
  sortOrder?: CatalogSortOrder = CatalogSortOrder.ASC;
}
