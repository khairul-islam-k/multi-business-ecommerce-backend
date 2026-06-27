import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

import {
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderReturnStatus,
  OrderSource,
  OrderStatus,
  OrderType,
} from "@/database/schema";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { SortedPaginationQueryDto } from "../../../common/http/query.dto";

export const OrderSortBy = {
  ORDER_NO: "orderNo",
  TOTAL_AMOUNT: "totalAmount",
  CREATED_AT: "createdAt",
  UPDATED_AT: "updatedAt",
} as const;
export type OrderSortBy = (typeof OrderSortBy)[keyof typeof OrderSortBy];

export class OrderItemInputDto {
  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountAmount?: number;
}

export class OrderPaymentInputDto {
  @ApiProperty({ enum: OrderPaymentMethod })
  @IsEnum(OrderPaymentMethod)
  paymentMethod!: OrderPaymentMethod;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  financeAccountId?: string;
}

export class OrderCourierInputDto {
  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  courierId!: string;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  deliveryZoneId!: string;

  @ApiPropertyOptional({ example: 80 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  courierFee!: number;

  @ApiPropertyOptional({ example: "Customer Name" })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  recipientName!: string;

  @ApiPropertyOptional({ example: "+8801700000000" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  recipientPhone!: string;

  @ApiPropertyOptional({ example: { address: "House 42, Street 69, Area Z" } })
  @IsOptional()
  deliveryAddressSnapshot!: unknown;
}

export class CreateOrderDto {
  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({ enum: OrderType, example: OrderType.ADMIN })
  @IsOptional()
  @IsEnum(OrderType)
  orderType?: OrderType;

  @ApiPropertyOptional({ enum: OrderSource, example: OrderSource.ADMIN_PANEL })
  @IsOptional()
  @IsEnum(OrderSource)
  orderSource?: OrderSource;

  @ApiPropertyOptional({ example: "Walk-in Customer" })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  customerName?: string;

  @ApiPropertyOptional({ example: "+8801700000000" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  customerPhone?: string;

  @ApiPropertyOptional({ example: "customer@example.com" })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  customerEmail?: string;

  @ApiPropertyOptional({ example: { address: "Dhaka" } })
  @IsOptional()
  shippingAddressSnapshot?: unknown;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  shippingCharge?: number;

  @ApiPropertyOptional({ example: "Customer asked for gift wrap" })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isCod?: boolean;

  @ApiProperty({ type: [OrderItemInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items!: OrderItemInputDto[];

  @ApiPropertyOptional({ type: OrderPaymentInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OrderPaymentInputDto)
  payment?: OrderPaymentInputDto;

  @ApiPropertyOptional({ type: OrderCourierInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OrderCourierInputDto)
  courier?: OrderCourierInputDto;
}

export class QueryOrderDto extends SortedPaginationQueryDto<OrderSortBy> {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ enum: OrderPaymentStatus })
  @IsOptional()
  @IsEnum(OrderPaymentStatus)
  paymentStatus?: OrderPaymentStatus;

  @ApiPropertyOptional({ enum: OrderType })
  @IsOptional()
  @IsEnum(OrderType)
  orderType?: OrderType;

  @ApiPropertyOptional({
    example: OrderSortBy.CREATED_AT,
    enum: OrderSortBy,
  })
  @IsOptional()
  @IsIn(Object.values(OrderSortBy))
  sortBy?: OrderSortBy = OrderSortBy.CREATED_AT;
}

export class AddOrderPaymentDto extends OrderPaymentInputDto {}

export class QueryOrderReturnDto extends SortedPaginationQueryDto<"createdAt"> {
  @ApiPropertyOptional({ enum: OrderReturnStatus })
  @IsOptional()
  @IsEnum(OrderReturnStatus)
  status?: OrderReturnStatus;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiPropertyOptional({ example: "createdAt", enum: ["createdAt"] })
  @IsOptional()
  @IsIn(["createdAt"])
  sortBy?: "createdAt" = "createdAt";
}

export class UpdateOrderReturnStatusDto {
  @ApiProperty({ enum: OrderReturnStatus })
  @IsEnum(OrderReturnStatus)
  status!: OrderReturnStatus;
}
