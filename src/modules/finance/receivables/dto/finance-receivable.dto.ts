import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  FinancePartyType,
  FinanceReceivableStatus,
  FinanceSourceType,
} from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export class QueryFinanceReceivableDto {
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

  @ApiPropertyOptional({ example: "REC" })
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

  @ApiPropertyOptional({ enum: FinanceReceivableStatus })
  @IsOptional()
  @IsEnum(FinanceReceivableStatus)
  status?: FinanceReceivableStatus;
}

export class ReceiveFinanceReceivableDto {
  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  financeAccountId!: string;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({ example: "Received supplier return refund" })
  @IsOptional()
  @IsString()
  note?: string;
}
