import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { ProductSimpleStatus } from "@/database/schema";
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateProductTagDto {
  @ApiProperty({ example: "summer" })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  @IsOptional()
  isFeatured: boolean = false;

  @ApiPropertyOptional({ enum: ProductSimpleStatus })
  @IsOptional()
  @IsEnum(ProductSimpleStatus)
  status?: ProductSimpleStatus;
}

export class UpdateProductTagDto extends PartialType(CreateProductTagDto) {}
