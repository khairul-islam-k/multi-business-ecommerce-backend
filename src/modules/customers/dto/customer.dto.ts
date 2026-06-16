import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  OrderAddressType,
  OrderCustomerStatus,
  OrderPaymentStatus,
  OrderStatus,
} from "@/database/schema";
import { Type } from "class-transformer";
import {
  IsEmail,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export enum CustomerSortBy {
  NAME = "name",
  CREATED_AT = "createdAt",
  UPDATED_AT = "updatedAt",
}

export enum CustomerSortOrder {
  ASC = "asc",
  DESC = "desc",
}

export enum CustomerOrderSortBy {
  CREATED_AT = "createdAt",
  ORDER_NO = "orderNo",
  TOTAL_AMOUNT = "totalAmount",
}

export class CreateCustomerDto {
  @ApiProperty({ example: "John Wick" })
  @IsString()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ example: "john@example.com" })
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({ example: "+8801700000000" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ enum: OrderCustomerStatus })
  @IsOptional()
  @IsEnum(OrderCustomerStatus)
  status?: OrderCustomerStatus;

  @ApiPropertyOptional({ example: "Frequent buyer" })
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}

export class QueryCustomerDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ example: "john" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: OrderCustomerStatus })
  @IsOptional()
  @IsEnum(OrderCustomerStatus)
  status?: OrderCustomerStatus;

  @ApiPropertyOptional({
    enum: CustomerSortBy,
    example: CustomerSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(CustomerSortBy)
  sortBy?: CustomerSortBy = CustomerSortBy.CREATED_AT;

  @ApiPropertyOptional({
    enum: CustomerSortOrder,
    example: CustomerSortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(CustomerSortOrder)
  sortOrder?: CustomerSortOrder = CustomerSortOrder.DESC;
}

export class CustomerAddressDto {
  @ApiPropertyOptional({ enum: OrderAddressType })
  @IsOptional()
  @IsEnum(OrderAddressType)
  addressType?: OrderAddressType;

  @ApiPropertyOptional({ example: "Home" })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiProperty({ example: "House 10, Road 2, Dhanmondi" })
  @IsString()
  address!: string;

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

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateCustomerAddressDto extends PartialType(CustomerAddressDto) {}

export class QueryCustomerOrderDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ example: "ORD" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ enum: OrderPaymentStatus })
  @IsOptional()
  @IsEnum(OrderPaymentStatus)
  paymentStatus?: OrderPaymentStatus;

  @ApiPropertyOptional({
    enum: CustomerOrderSortBy,
    example: CustomerOrderSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(CustomerOrderSortBy)
  sortBy?: CustomerOrderSortBy = CustomerOrderSortBy.CREATED_AT;

  @ApiPropertyOptional({
    enum: CustomerSortOrder,
    example: CustomerSortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(CustomerSortOrder)
  sortOrder?: CustomerSortOrder = CustomerSortOrder.DESC;
}
