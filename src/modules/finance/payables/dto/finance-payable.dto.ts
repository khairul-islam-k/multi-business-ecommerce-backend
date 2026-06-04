import { Type } from "class-transformer";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  FinancePartyType,
  FinancePayableStatus,
  FinanceSourceType,
  SupplierPaymentMethod,
} from "@prisma/client";

export class QueryFinancePayableDto {
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

  @ApiPropertyOptional({ example: "PAYB" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: FinancePartyType })
  @IsOptional()
  @IsEnum(FinancePartyType)
  partyType?: FinancePartyType;

  @ApiPropertyOptional({ enum: FinanceSourceType })
  @IsOptional()
  @IsEnum(FinanceSourceType)
  sourceType?: FinanceSourceType;

  @ApiPropertyOptional({ enum: FinancePayableStatus })
  @IsOptional()
  @IsEnum(FinancePayableStatus)
  status?: FinancePayableStatus;
}

export class PayFinancePayableDto {
  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  financeAccountId!: string;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({ enum: SupplierPaymentMethod })
  @IsOptional()
  @IsEnum(SupplierPaymentMethod)
  paymentMethod?: SupplierPaymentMethod;

  @ApiPropertyOptional({ example: "Paid supplier invoice" })
  @IsOptional()
  @IsString()
  note?: string;
}
