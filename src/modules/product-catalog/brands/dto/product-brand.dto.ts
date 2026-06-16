import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { ProductSimpleStatus } from "@/database/schema";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class CreateProductBrandDto {
  @ApiProperty({ example: "Nike" })
  @IsString()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ example: "Sportswear brand" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: "https://cdn.example.com/brands/nike.png" })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ enum: ProductSimpleStatus })
  @IsOptional()
  @IsEnum(ProductSimpleStatus)
  status?: ProductSimpleStatus;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateProductBrandDto extends PartialType(CreateProductBrandDto) {}
