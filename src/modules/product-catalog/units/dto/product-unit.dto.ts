import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

import { ProductSimpleStatus } from "@/database/schema";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";

export class CreateProductUnitDto {
  @ApiProperty({ example: "Piece" })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ enum: ProductSimpleStatus })
  @IsOptional()
  @IsEnum(ProductSimpleStatus)
  status?: ProductSimpleStatus;
}

export class UpdateProductUnitDto extends PartialType(CreateProductUnitDto) {}
