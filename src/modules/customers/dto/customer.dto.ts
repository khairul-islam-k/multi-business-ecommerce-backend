import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

import {
  CustomerAddressType,
  CustomerStatus,
  OrderPaymentStatus,
  OrderStatus,
} from "@/database/schema";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { SortedPaginationQueryDto } from "../../../common/http/query.dto";
export { SortOrder as CustomerSortOrder } from "../../../common/http/sort.util";

export enum CustomerSortBy {
  NAME = "name",
  CREATED_AT = "createdAt",
  UPDATED_AT = "updatedAt",
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

  @ApiPropertyOptional({ enum: CustomerStatus })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @ApiPropertyOptional({ example: "Frequent buyer" })
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}

export class QueryCustomerDto extends SortedPaginationQueryDto<CustomerSortBy> {
  @ApiPropertyOptional({ enum: CustomerStatus })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @ApiPropertyOptional({
    enum: CustomerSortBy,
    example: CustomerSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(CustomerSortBy)
  sortBy?: CustomerSortBy = CustomerSortBy.CREATED_AT;
}

export class CustomerAddressDto {
  @ApiPropertyOptional({ enum: CustomerAddressType })
  @IsOptional()
  @IsEnum(CustomerAddressType)
  addressType?: CustomerAddressType;

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

export class QueryCustomerOrderDto extends SortedPaginationQueryDto<CustomerOrderSortBy> {
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
}
