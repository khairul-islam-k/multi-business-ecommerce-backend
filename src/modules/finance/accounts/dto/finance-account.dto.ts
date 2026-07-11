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

import { FinanceAccountStatus, FinanceAccountType } from "@/database/schema";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";

export class CreateFinanceAccountDto {
  @ApiProperty({ example: "Main Cash" })
  @IsString()
  @MaxLength(150)
  name!: string;

  @ApiProperty({ enum: FinanceAccountType })
  @IsEnum(FinanceAccountType)
  accountType!: FinanceAccountType;

  @ApiPropertyOptional({ example: "ACC-001" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  accountNumber?: string;

  @ApiPropertyOptional({ example: "BDT" })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currencyCode?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  openingBalance?: number;

  @ApiPropertyOptional({ enum: FinanceAccountStatus })
  @IsOptional()
  @IsEnum(FinanceAccountStatus)
  status?: FinanceAccountStatus;
}

export class UpdateFinanceAccountDto extends PartialType(
  CreateFinanceAccountDto,
) {}

export class AddFinanceAccountMoneyDto {
  @ApiProperty({ example: 5000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ example: "Owner cash deposit" })
  @IsOptional()
  @IsString()
  note?: string;
}

export class QueryFinanceAccountDto {
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

  @ApiPropertyOptional({ example: "cash" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: FinanceAccountType })
  @IsOptional()
  @IsEnum(FinanceAccountType)
  accountType?: FinanceAccountType;

  @ApiPropertyOptional({ enum: FinanceAccountStatus })
  @IsOptional()
  @IsEnum(FinanceAccountStatus)
  status?: FinanceAccountStatus;
}

export class QueryFinanceTransactionDto {
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

  @ApiPropertyOptional({ example: "TXN-001" })
  @IsOptional()
  @IsString()
  search?: string;
}
