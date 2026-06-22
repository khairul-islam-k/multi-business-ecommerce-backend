import { IsIn, IsOptional, IsString, IsUUID } from "class-validator";

import { ApiPropertyOptional } from "@nestjs/swagger";

import { SortedPaginationQueryDto } from "../../../common/http/query.dto";

export const StorefrontProductSortBy = {
  NAME: "name",
  PRICE: "price",
  CREATED_AT: "createdAt",
} as const;
export type StorefrontProductSortBy =
  (typeof StorefrontProductSortBy)[keyof typeof StorefrontProductSortBy];

export class ResolveStorefrontDto {
  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  websiteId?: string;

  @ApiPropertyOptional({ example: "acme-store" })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ example: "shop.example.com" })
  @IsOptional()
  @IsString()
  host?: string;
}

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
