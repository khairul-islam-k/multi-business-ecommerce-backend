import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

import {
  PaymentGatewayConfigStatus,
  PaymentGatewayMode,
  PaymentGatewayProvider,
  PaymentGatewayStatus,
} from "@/database/schema";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";

import { SearchablePaginationQueryDto } from "../../../common/http/query.dto";

export class QueryPaymentGatewayDto extends SearchablePaginationQueryDto {
  @ApiPropertyOptional({ enum: PaymentGatewayStatus })
  @IsOptional()
  @IsEnum(PaymentGatewayStatus)
  status?: PaymentGatewayStatus;
}

export class QueryPaymentGatewayConfigDto extends SearchablePaginationQueryDto {
  @ApiPropertyOptional({ enum: PaymentGatewayProvider })
  @IsOptional()
  @IsEnum(PaymentGatewayProvider)
  provider?: PaymentGatewayProvider;

  @ApiPropertyOptional({ enum: PaymentGatewayMode })
  @IsOptional()
  @IsEnum(PaymentGatewayMode)
  mode?: PaymentGatewayMode;

  @ApiPropertyOptional({ enum: PaymentGatewayConfigStatus })
  @IsOptional()
  @IsEnum(PaymentGatewayConfigStatus)
  status?: PaymentGatewayConfigStatus;
}

export class CreatePaymentGatewayConfigDto {
  @ApiProperty({ enum: PaymentGatewayProvider })
  @IsEnum(PaymentGatewayProvider)
  provider!: PaymentGatewayProvider;

  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  financeAccountId!: string;

  @ApiProperty({ enum: PaymentGatewayMode })
  @IsEnum(PaymentGatewayMode)
  mode!: PaymentGatewayMode;

  @ApiPropertyOptional({ enum: PaymentGatewayConfigStatus })
  @IsOptional()
  @IsEnum(PaymentGatewayConfigStatus)
  status?: PaymentGatewayConfigStatus;

  @ApiProperty({ example: { storeId: "merchant-id" } })
  @IsObject()
  configData!: Record<string, unknown>;
}

export class BulkCreatePaymentGatewayConfigDto {
  @ApiProperty({ type: [CreatePaymentGatewayConfigDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreatePaymentGatewayConfigDto)
  configs!: CreatePaymentGatewayConfigDto[];
}

export class UpdatePaymentGatewayConfigDto extends PartialType(
  CreatePaymentGatewayConfigDto,
) {}

export class BulkUpdatePaymentGatewayConfigItemDto extends UpdatePaymentGatewayConfigDto {
  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  id!: string;
}

export class BulkUpdatePaymentGatewayConfigDto {
  @ApiProperty({ type: [BulkUpdatePaymentGatewayConfigItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BulkUpdatePaymentGatewayConfigItemDto)
  configs!: BulkUpdatePaymentGatewayConfigItemDto[];
}

export class UpdatePaymentGatewayConfigStatusDto {
  @ApiProperty({ enum: PaymentGatewayConfigStatus })
  @IsEnum(PaymentGatewayConfigStatus)
  status!: PaymentGatewayConfigStatus;
}

export class InitiateStorefrontPaymentDto {
  @ApiProperty({ enum: PaymentGatewayProvider })
  @IsEnum(PaymentGatewayProvider)
  provider!: PaymentGatewayProvider;

  @ApiPropertyOptional({ example: "https://shop.example.com/payment/success" })
  @IsOptional()
  @IsString()
  successRedirectUrl!: string;

  @ApiPropertyOptional({ example: "https://shop.example.com/payment/failed" })
  @IsOptional()
  @IsString()
  failRedirectUrl!: string;

  @ApiPropertyOptional({
    example: "https://shop.example.com/payment/cancelled",
  })
  @IsOptional()
  @IsString()
  cancelRedirectUrl!: string;
}

export class PaymentCallbackQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  val_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tran_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mer_txnid?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  order_id?: string;
}

export class SeedPaymentGatewayDto {
  @ApiProperty({ enum: PaymentGatewayProvider })
  @IsEnum(PaymentGatewayProvider)
  code!: PaymentGatewayProvider;

  @ApiProperty({ example: "SSLCOMMERZ" })
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: PaymentGatewayStatus })
  @IsOptional()
  @IsEnum(PaymentGatewayStatus)
  status?: PaymentGatewayStatus;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(999999)
  sortOrder?: number;
}
