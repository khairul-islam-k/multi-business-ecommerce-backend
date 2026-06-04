import { Type } from "class-transformer";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { FinanceTaxStatus } from "@prisma/client";

export class CreateFinanceTaxDto {
  @ApiProperty({ example: "VAT 5%" })
  @IsString()
  @MaxLength(150)
  name!: string;

  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  rate!: number;

  @ApiPropertyOptional({ example: "Default VAT" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: FinanceTaxStatus })
  @IsOptional()
  @IsEnum(FinanceTaxStatus)
  status?: FinanceTaxStatus;
}

export class UpdateFinanceTaxDto extends PartialType(CreateFinanceTaxDto) {}

export class QueryFinanceTaxDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ example: "vat" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: FinanceTaxStatus })
  @IsOptional()
  @IsEnum(FinanceTaxStatus)
  status?: FinanceTaxStatus;
}
