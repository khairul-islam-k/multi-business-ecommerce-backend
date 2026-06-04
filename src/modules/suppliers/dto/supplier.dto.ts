import { Type } from "class-transformer";
import {
  IsArray,
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  SupplierProductMapStatus,
  SupplierInvoiceStatus,
  SupplierPurchaseOrderStatus,
  SupplierPurchaseReturnStatus,
  SupplierStatus,
} from "@prisma/client";

import { CatalogSortOrder } from "../../product-catalog/common/dto/query-catalog.dto";

export class CreateSupplierDto {
  @ApiProperty({ example: "Acme Supply" })
  @IsString()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ example: "Acme Supply Ltd." })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  companyName?: string;

  @ApiPropertyOptional({ example: "buyer@acme.test" })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({ example: "+8801700000000" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: "House 10, Road 2, Dhaka" })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: "Dhaka" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: "Bangladesh" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({ enum: SupplierStatus })
  @IsOptional()
  @IsEnum(SupplierStatus)
  status?: SupplierStatus;

  @ApiPropertyOptional({ example: "Preferred local supplier" })
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}

export class QuerySupplierDto {
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

  @ApiPropertyOptional({ example: "acme" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: SupplierStatus })
  @IsOptional()
  @IsEnum(SupplierStatus)
  status?: SupplierStatus;

  @ApiPropertyOptional({
    enum: CatalogSortOrder,
    example: CatalogSortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(CatalogSortOrder)
  sortOrder?: CatalogSortOrder = CatalogSortOrder.DESC;
}

export class SupplierProductMapDto {
  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiPropertyOptional({ example: "SUP-SKU-01" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  supplierSku?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lastPurchasePrice?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minOrderQuantity?: number;

  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  leadTimeDays?: number;

  @ApiPropertyOptional({ enum: SupplierProductMapStatus })
  @IsOptional()
  @IsEnum(SupplierProductMapStatus)
  status?: SupplierProductMapStatus;
}

export class UpdateSupplierProductMapDto extends PartialType(
  SupplierProductMapDto,
) {}

export class PurchaseOrderItemDto {
  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantityOrdered!: number;

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost!: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountAmount?: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  supplierId!: string;

  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  warehouseId!: string;

  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  taxId!: string;

  @ApiPropertyOptional({ example: "2026-05-25T00:00:00.000Z" })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expectedDeliveryDate?: Date;

  @ApiPropertyOptional({ enum: SupplierPurchaseOrderStatus })
  @IsOptional()
  @IsEnum(SupplierPurchaseOrderStatus)
  status?: SupplierPurchaseOrderStatus;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  shippingCost?: number;

  @ApiPropertyOptional({ example: "Urgent purchase" })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ type: [PurchaseOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items!: PurchaseOrderItemDto[];
}

export class UpdatePurchaseOrderDto {
  @ApiPropertyOptional({ example: "2026-05-25T00:00:00.000Z" })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expectedDeliveryDate?: Date;

  @ApiPropertyOptional({ enum: SupplierPurchaseOrderStatus })
  @IsOptional()
  @IsEnum(SupplierPurchaseOrderStatus)
  status?: SupplierPurchaseOrderStatus;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  shippingCost?: number;

  @ApiPropertyOptional({ example: "Updated note" })
  @IsOptional()
  @IsString()
  note?: string;
}

export class QueryPurchaseOrderDto {
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

  @ApiPropertyOptional({ example: "PO" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({ enum: SupplierPurchaseOrderStatus })
  @IsOptional()
  @IsEnum(SupplierPurchaseOrderStatus)
  status?: SupplierPurchaseOrderStatus;
}

export class ReceivePurchaseOrderDto {
  @ApiPropertyOptional({ example: "Received at dock A" })
  @IsOptional()
  @IsString()
  note?: string;
}

export class QuerySupplierInvoiceDto {
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

  @ApiPropertyOptional({ example: "SIN" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ enum: SupplierInvoiceStatus })
  @IsOptional()
  @IsEnum(SupplierInvoiceStatus)
  status?: SupplierInvoiceStatus;
}

export class SupplierPurchaseReturnItemDto {
  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @ApiPropertyOptional({ example: "Damaged item" })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateSupplierPurchaseReturnDto {
  @ApiPropertyOptional({ example: "2026-06-02T00:00:00.000Z" })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  returnDate?: Date;

  @ApiPropertyOptional({ example: "Supplier agreed to take these back" })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ type: [SupplierPurchaseReturnItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplierPurchaseReturnItemDto)
  items!: SupplierPurchaseReturnItemDto[];
}

export class QuerySupplierPurchaseReturnDto {
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

  @ApiPropertyOptional({ example: "RET" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @ApiPropertyOptional({ enum: SupplierPurchaseReturnStatus })
  @IsOptional()
  @IsEnum(SupplierPurchaseReturnStatus)
  status?: SupplierPurchaseReturnStatus;
}
