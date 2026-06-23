import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

import {
  OrderCartStatus,
  OrderPaymentStatus,
  OrderStatus,
  ProductReviewStatus,
} from "@/database/schema";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { SortedPaginationQueryDto } from "../../../common/http/query.dto";
import { OrderSortBy } from "../../orders/dto/order.dto";

export class StorefrontCartQueryDto {
  @ApiPropertyOptional({ enum: OrderCartStatus })
  @IsOptional()
  @IsEnum(OrderCartStatus)
  status?: OrderCartStatus;
}

export class AddStorefrontCartItemDto {
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
}

export class UpdateStorefrontCartItemDto {
  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;
}

export class CreateStorefrontReviewDto {
  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ example: "Great keyboard" })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @ApiPropertyOptional({ example: "The build quality feels excellent." })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class StorefrontReviewQueryDto {
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

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ enum: ProductReviewStatus })
  @IsOptional()
  @IsEnum(ProductReviewStatus)
  status?: ProductReviewStatus;
}

export class PlaceStorefrontOrderDto {
  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({ example: { address: "House 42, Dhaka" } })
  @IsOptional()
  shippingAddressSnapshot?: unknown;

  @ApiPropertyOptional({ example: 80 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  shippingCharge?: number;

  @ApiPropertyOptional({ example: "Please call before delivery" })
  @IsOptional()
  @IsString()
  note?: string;
}

export class StorefrontOrderQueryDto extends SortedPaginationQueryDto<OrderSortBy> {
  @ApiPropertyOptional({
    enum: OrderSortBy,
    example: OrderSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsIn(Object.values(OrderSortBy))
  sortBy?: OrderSortBy = OrderSortBy.CREATED_AT;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ enum: OrderPaymentStatus })
  @IsOptional()
  @IsEnum(OrderPaymentStatus)
  paymentStatus?: OrderPaymentStatus;
}

export class CancelStorefrontOrderDto {
  @ApiPropertyOptional({ example: "Ordered by mistake" })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class StorefrontReturnItemDto {
  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  orderItemId!: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @ApiPropertyOptional({ example: "Damaged item" })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateStorefrontOrderReturnDto {
  @ApiPropertyOptional({ example: "Product arrived damaged" })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ type: [StorefrontReturnItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StorefrontReturnItemDto)
  items!: StorefrontReturnItemDto[];
}
