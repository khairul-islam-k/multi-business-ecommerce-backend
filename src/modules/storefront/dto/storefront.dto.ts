import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsUUID,
  IsString,
  ValidateNested,
} from "class-validator";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import {
  PaginationQueryDto,
  SortedPaginationQueryDto,
} from "../../../common/http/query.dto";

export class StorefrontCatalogSearchDto {
  @ApiPropertyOptional({ example: "search" })
  @IsOptional()
  @IsString()
  search?: string;
}

export const StorefrontProductSortBy = {
  NAME: "name",
  PRICE: "price",
  CREATED_AT: "createdAt",
} as const;
export type StorefrontProductSortBy =
  (typeof StorefrontProductSortBy)[keyof typeof StorefrontProductSortBy];

export class StorefrontProductQueryDto extends SortedPaginationQueryDto<StorefrontProductSortBy> {
  @ApiPropertyOptional({ example: 12, default: 12 })
  limit?: number = 12;

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
    example: "createdAt",
    enum: StorefrontProductSortBy,
  })
  @IsOptional()
  @IsIn(Object.values(StorefrontProductSortBy))
  sortBy?: StorefrontProductSortBy = StorefrontProductSortBy.CREATED_AT;
}

export class StorefrontProductReviewQueryDto extends PaginationQueryDto {}

export class StorefrontVariantAttributeSelectionDto {
  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  attributeId!: string;

  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  attributeValueId!: string;
}

export class ResolveStorefrontVariantDto {
  @ApiProperty({ type: [StorefrontVariantAttributeSelectionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StorefrontVariantAttributeSelectionDto)
  attributes!: StorefrontVariantAttributeSelectionDto[];
}
