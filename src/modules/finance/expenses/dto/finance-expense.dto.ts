import { Type } from "class-transformer";
import {
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

import {
  FinanceExpenseCategoryStatus,
  FinanceExpenseStatus,
} from "@/database/schema";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";

export class CreateExpenseCategoryDto {
  @ApiProperty({ example: "Office Rent" })
  @IsString()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ example: "Monthly office rent" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: FinanceExpenseCategoryStatus })
  @IsOptional()
  @IsEnum(FinanceExpenseCategoryStatus)
  status?: FinanceExpenseCategoryStatus;
}

export class UpdateExpenseCategoryDto extends PartialType(
  CreateExpenseCategoryDto,
) {}

export class QueryExpenseCategoryDto {
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

  @ApiPropertyOptional({ example: "rent" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: FinanceExpenseCategoryStatus })
  @IsOptional()
  @IsEnum(FinanceExpenseCategoryStatus)
  status?: FinanceExpenseCategoryStatus;
}

export class CreateExpenseDto {
  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  accountId!: string;

  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  expenseCategoryId!: string;

  @ApiProperty({ example: "Packaging materials" })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiProperty({ example: 500 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ example: "2026-06-02T00:00:00.000Z" })
  @Type(() => Date)
  @IsDate()
  expenseDate!: Date;

  @ApiPropertyOptional({ example: "Paid to local vendor" })
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}

export class QueryExpenseDto {
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
  limit?: number = 10;

  @ApiPropertyOptional({ example: "packaging" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: FinanceExpenseStatus })
  @IsOptional()
  @IsEnum(FinanceExpenseStatus)
  status?: FinanceExpenseStatus;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  expenseCategoryId?: string;
}
