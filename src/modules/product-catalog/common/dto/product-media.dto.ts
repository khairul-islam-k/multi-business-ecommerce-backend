import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class ProductImageInputDto {
  @ApiPropertyOptional({ example: "https://cdn.example.com/product.jpg" })
  @IsString()
  imageUrl!: string;

  @ApiPropertyOptional({ example: "Front view" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  altText?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isThumbnail?: boolean;
}

export class ProductTagIdsDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  tagIds?: string[];
}

export class ProductImagesDto {
  @ApiPropertyOptional({ type: [ProductImageInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageInputDto)
  images?: ProductImageInputDto[];
}
