import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { ProductSimpleStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

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
