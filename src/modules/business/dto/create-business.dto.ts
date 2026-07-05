import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { BusinessBrandingDensity, BusinessStatus } from "@/database/schema";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
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
  autoConfirmOrder?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  codEnabled?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  onlinePaymentEnabled?: boolean;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  defaultWarehouseId?: string;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  defaultFinanceAccountId?: string;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  defaultUnitId?: string;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  defaultTaxId?: string;
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

  @ApiPropertyOptional({ example: "#00063a" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "primaryHoverColor must be a valid hex color",
  })
  primaryHoverColor?: string;

  @ApiPropertyOptional({ example: "#00051f" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "primaryActiveColor must be a valid hex color",
  })
  primaryActiveColor?: string;

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

  @ApiPropertyOptional({ example: "#16a34a" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "successColor must be a valid hex color",
  })
  successColor?: string;

  @ApiPropertyOptional({ example: "#f59e0b" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "warningColor must be a valid hex color",
  })
  warningColor?: string;

  @ApiPropertyOptional({ example: "#dc2626" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "errorColor must be a valid hex color",
  })
  errorColor?: string;

  @ApiPropertyOptional({ example: "#2563eb" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "infoColor must be a valid hex color",
  })
  infoColor?: string;

  @ApiPropertyOptional({ example: "#f8fafc" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "dashboardBackgroundColor must be a valid hex color",
  })
  dashboardBackgroundColor?: string;

  @ApiPropertyOptional({ example: "#0f172a" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "sidebarBackgroundColor must be a valid hex color",
  })
  sidebarBackgroundColor?: string;

  @ApiPropertyOptional({ example: "#e2e8f0" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "sidebarTextColor must be a valid hex color",
  })
  sidebarTextColor?: string;

  @ApiPropertyOptional({ example: "#94a3b8" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "sidebarMutedTextColor must be a valid hex color",
  })
  sidebarMutedTextColor?: string;

  @ApiPropertyOptional({ example: "#1e293b" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "sidebarActiveBackgroundColor must be a valid hex color",
  })
  sidebarActiveBackgroundColor?: string;

  @ApiPropertyOptional({ example: "#ffffff" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "sidebarActiveTextColor must be a valid hex color",
  })
  sidebarActiveTextColor?: string;

  @ApiPropertyOptional({ example: "#172033" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "sidebarHoverBackgroundColor must be a valid hex color",
  })
  sidebarHoverBackgroundColor?: string;

  @ApiPropertyOptional({ example: "#ffffff" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "headerBackgroundColor must be a valid hex color",
  })
  headerBackgroundColor?: string;

  @ApiPropertyOptional({ example: "#111827" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "headerTextColor must be a valid hex color",
  })
  headerTextColor?: string;

  @ApiPropertyOptional({ example: "#ffffff" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "cardBackgroundColor must be a valid hex color",
  })
  cardBackgroundColor?: string;

  @ApiPropertyOptional({ example: "#ffffff" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "elevatedBackgroundColor must be a valid hex color",
  })
  elevatedBackgroundColor?: string;

  @ApiPropertyOptional({ example: "#f1f5f9" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "tableHeaderBackgroundColor must be a valid hex color",
  })
  tableHeaderBackgroundColor?: string;

  @ApiPropertyOptional({ example: "#f8fafc" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "tableRowHoverColor must be a valid hex color",
  })
  tableRowHoverColor?: string;

  @ApiPropertyOptional({ example: "#ffffff" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "inputBackgroundColor must be a valid hex color",
  })
  inputBackgroundColor?: string;

  @ApiPropertyOptional({ example: "#e5e7eb" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "disabledBackgroundColor must be a valid hex color",
  })
  disabledBackgroundColor?: string;

  @ApiPropertyOptional({ example: "#111827" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "textPrimaryColor must be a valid hex color",
  })
  textPrimaryColor?: string;

  @ApiPropertyOptional({ example: "#475569" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "textSecondaryColor must be a valid hex color",
  })
  textSecondaryColor?: string;

  @ApiPropertyOptional({ example: "#64748b" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "textMutedColor must be a valid hex color",
  })
  textMutedColor?: string;

  @ApiPropertyOptional({ example: "#ffffff" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "textInverseColor must be a valid hex color",
  })
  textInverseColor?: string;

  @ApiPropertyOptional({ example: "#cbd5e1" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "borderColor must be a valid hex color",
  })
  borderColor?: string;

  @ApiPropertyOptional({ example: "#e2e8f0" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "borderSubtleColor must be a valid hex color",
  })
  borderSubtleColor?: string;

  @ApiPropertyOptional({ example: "#93c5fd" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: "focusRingColor must be a valid hex color",
  })
  focusRingColor?: string;

  @ApiPropertyOptional({ example: "Inter" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fontFamily?: string;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @IsInt()
  borderRadius?: number;

  @ApiPropertyOptional({
    enum: BusinessBrandingDensity,
    example: BusinessBrandingDensity.DEFAULT,
  })
  @IsOptional()
  @IsEnum(BusinessBrandingDensity)
  density?: BusinessBrandingDensity;

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
