import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsUUID,
  IsString,
  ValidateNested,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsEmail,
} from "class-validator";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import {
  PaginationQueryDto,
  SortedPaginationQueryDto,
} from "../../../common/http/query.dto";

export class StorefrontContactDto {
  @ApiProperty({
    example: "John Doe",
    description: "Customer full name",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: "+8801712345678",
    description: "Customer phone number",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(7)
  @MaxLength(20)
  phone!: string;

  @ApiProperty({
    example: "john@example.com",
    description: "Customer email address",
  })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(150)
  email!: string;

  @ApiPropertyOptional({
    example: "Product inquiry",
    description: "Subject of the contact message",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional({
    example: "I would like to know more about this product.",
    description: "Customer contact message",
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

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
