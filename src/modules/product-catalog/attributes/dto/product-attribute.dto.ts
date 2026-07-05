import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";

import { ProductSimpleStatus } from "@/database/schema";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";

import { SortedPaginationQueryDto } from "../../../../common/http/query.dto";
import { SortOrder } from "../../../../common/http/sort.util";

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

export class QueryProductAttributeDto extends SortedPaginationQueryDto<ProductAttributeSortBy> {
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
    enum: SortOrder,
    example: SortOrder.ASC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.ASC;
}
