import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { BusinessStatus } from "@/database/schema";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class CreateBusinessSettingDto {
  @ApiPropertyOptional({ example: "ORD" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  orderPrefix?: string;

  @ApiPropertyOptional({ example: "INV" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  invoicePrefix?: string;

  @ApiPropertyOptional({ example: "PAY" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  paymentPrefix?: string;

  @ApiPropertyOptional({ example: "SHP" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  shipmentPrefix?: string;

  @ApiPropertyOptional({ example: "PO" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  purchaseOrderPrefix?: string;

  @ApiPropertyOptional({ example: "RET" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  purchaseReturnPrefix?: string;

  @ApiPropertyOptional({ example: "ADJ" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  stockAdjustmentPrefix?: string;

  @ApiPropertyOptional({ example: "TRF" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  stockTransferPrefix?: string;

  @ApiPropertyOptional({ example: "EXP" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  expensePrefix?: string;

  @ApiPropertyOptional({ example: "SIN" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  supplierInvoicePrefix?: string;

  @ApiPropertyOptional({ example: "SPAY" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  supplierPaymentPrefix?: string;

  @ApiPropertyOptional({ example: "REC" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  receivablePrefix?: string;

  @ApiPropertyOptional({ example: "PAYB" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  payablePrefix?: string;

  @ApiPropertyOptional({ example: "TXN" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  transactionPrefix?: string;

  @ApiPropertyOptional({ example: "SKU" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  productSkuPrefix?: string;

  @ApiPropertyOptional({ example: "BAR" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  productBarcodePrefix?: string;

  @ApiPropertyOptional({ example: "SKU" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  variantSkuPrefix?: string;

  @ApiPropertyOptional({ example: "BAR" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  variantBarcodePrefix?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999999)
  lowStockThreshold?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  allowBackorder?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  autoConfirmOrder?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  codEnabled?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  onlinePaymentEnabled?: boolean;
}

export class CreateBusinessBrandingDto {
  @ApiPropertyOptional({ example: "https://example.com/logo.png" })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: "https://example.com/favicon.ico" })
  @IsOptional()
  @IsString()
  faviconUrl?: string;

  @ApiPropertyOptional({ example: "#000742" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "primaryColor must be a valid hex color",
  })
  primaryColor?: string;

  @ApiPropertyOptional({ example: "#ffffff" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "secondaryColor must be a valid hex color",
  })
  secondaryColor?: string;

  @ApiPropertyOptional({ example: "#f97316" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "accentColor must be a valid hex color",
  })
  accentColor?: string;

  @ApiPropertyOptional({ example: "Inter" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fontFamily?: string;

  @ApiPropertyOptional({ example: "My Business" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  seoTitle?: string;

  @ApiPropertyOptional({ example: "An awesome business" })
  @IsOptional()
  @IsString()
  seoDescription?: string;
}

export class CreateBusinessDto {
  @ApiProperty({ example: "My Business" })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ example: "business@example.com" })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: "+8801712345678" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: "Bangladesh" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({ example: "BDT", default: "BDT" })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Matches(/^[A-Z]{3,10}$/, {
    message: "currencyCode must be uppercase, for example BDT",
  })
  currencyCode?: string;

  @ApiPropertyOptional({ example: "Asia/Dhaka", default: "Asia/Dhaka" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  @ApiPropertyOptional({
    enum: BusinessStatus,
    default: BusinessStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(BusinessStatus)
  status?: BusinessStatus;

  @ApiPropertyOptional({ type: CreateBusinessSettingDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateBusinessSettingDto)
  settings?: CreateBusinessSettingDto;

  @ApiPropertyOptional({ type: CreateBusinessBrandingDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateBusinessBrandingDto)
  branding?: CreateBusinessBrandingDto;
}
