import { Type } from "class-transformer";
import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

import { ProductReviewStatus } from "@/database/schema";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateProductReviewDto {
  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ example: "Great keyboard" })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @ApiPropertyOptional({ example: "The build quality feels excellent." })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({ example: "Jane Doe" })
  @IsString()
  @MaxLength(150)
  reviewerName!: string;

  @ApiPropertyOptional({ example: "jane@example.com" })
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  reviewerEmail?: string;

  @ApiPropertyOptional({ example: "+8801700000000" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  reviewerPhone?: string;
}

export class QueryProductReviewDto {
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

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiPropertyOptional({ enum: ProductReviewStatus })
  @IsOptional()
  @IsEnum(ProductReviewStatus)
  status?: ProductReviewStatus;
}

export class UpdateProductReviewStatusDto {
  @ApiProperty({ enum: ProductReviewStatus })
  @IsEnum(ProductReviewStatus)
  status!: ProductReviewStatus;
}
