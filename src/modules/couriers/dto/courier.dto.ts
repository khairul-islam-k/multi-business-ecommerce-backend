import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

import {
  CourierConfigMode,
  CourierConfigStatus,
  CourierAreaType,
  CourierDeliveryZoneStatus,
  CourierProvider,
  CourierShippingChargeStatus,
  CourierStatus,
} from "@/database/schema";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";

import { SearchablePaginationQueryDto } from "../../../common/http/query.dto";

export class QueryCourierDto extends SearchablePaginationQueryDto {
  @ApiPropertyOptional({ enum: CourierStatus })
  @IsOptional()
  @IsEnum(CourierStatus)
  status?: CourierStatus;
}

export class QueryCourierConfigDto extends SearchablePaginationQueryDto {
  @ApiPropertyOptional({ enum: CourierProvider })
  @IsOptional()
  @IsEnum(CourierProvider)
  provider?: CourierProvider;

  @ApiPropertyOptional({ enum: CourierConfigMode })
  @IsOptional()
  @IsEnum(CourierConfigMode)
  mode?: CourierConfigMode;

  @ApiPropertyOptional({ enum: CourierConfigStatus })
  @IsOptional()
  @IsEnum(CourierConfigStatus)
  status?: CourierConfigStatus;
}

export class QueryCourierDeliveryZoneDto extends SearchablePaginationQueryDto {
  @ApiPropertyOptional({ enum: CourierDeliveryZoneStatus })
  @IsOptional()
  @IsEnum(CourierDeliveryZoneStatus)
  status?: CourierDeliveryZoneStatus;
}

export class QueryCourierAreaCatalogDto extends SearchablePaginationQueryDto {
  @ApiPropertyOptional({ example: "BD_GEOCODE" })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ enum: CourierAreaType })
  @IsOptional()
  @IsEnum(CourierAreaType)
  areaType?: CourierAreaType;

  @ApiPropertyOptional({ example: "Dhaka" })
  @IsOptional()
  @IsString()
  divisionName?: string;

  @ApiPropertyOptional({ example: "Dhaka" })
  @IsOptional()
  @IsString()
  districtName?: string;

  @ApiPropertyOptional({ example: "Savar" })
  @IsOptional()
  @IsString()
  upazilaName?: string;
}

export class AddCourierAreaCatalogToZoneDto {
  @ApiProperty({
    type: [String],
    example: ["2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913"],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsUUID(undefined, { each: true })
  areaIds!: string[];
}

export class CreateCourierDeliveryZoneAreaDto {
  @ApiProperty({ example: "Dhanmondi" })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  areaName!: string;

  @ApiPropertyOptional({ example: "Dhaka" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;
}

export class CreateCourierDeliveryZoneDto {
  @ApiProperty({ example: "Inside Dhaka" })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: CourierDeliveryZoneStatus })
  @IsOptional()
  @IsEnum(CourierDeliveryZoneStatus)
  status?: CourierDeliveryZoneStatus;

  @ApiPropertyOptional({ type: [CreateCourierDeliveryZoneAreaDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCourierDeliveryZoneAreaDto)
  areas?: CreateCourierDeliveryZoneAreaDto[];
}

export class UpdateCourierDeliveryZoneDto extends PartialType(
  CreateCourierDeliveryZoneDto,
) {}

export class UpdateCourierDeliveryZoneAreaDto extends PartialType(
  CreateCourierDeliveryZoneAreaDto,
) {}

export class QueryCourierShippingChargeDto extends SearchablePaginationQueryDto {
  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  deliveryZoneId?: string;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  courierId?: string;

  @ApiPropertyOptional({ enum: CourierShippingChargeStatus })
  @IsOptional()
  @IsEnum(CourierShippingChargeStatus)
  status?: CourierShippingChargeStatus;
}

export class CreateCourierShippingChargeDto {
  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  deliveryZoneId!: string;

  @ApiPropertyOptional({
    example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913",
    description:
      "Leave empty to create a generic zone charge used by any courier without a courier-specific charge.",
  })
  @IsOptional()
  @IsUUID()
  courierId?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minWeight?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxWeight?: number;

  @ApiProperty({ example: 80 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  shippingCharge!: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  codCharge?: number;

  @ApiPropertyOptional({ enum: CourierShippingChargeStatus })
  @IsOptional()
  @IsEnum(CourierShippingChargeStatus)
  status?: CourierShippingChargeStatus;
}

export class UpdateCourierShippingChargeDto extends PartialType(
  CreateCourierShippingChargeDto,
) {}

export class UpdateCourierConfigDto {
  @ApiPropertyOptional({ enum: CourierConfigMode })
  @IsOptional()
  @IsEnum(CourierConfigMode)
  mode?: CourierConfigMode;

  @ApiPropertyOptional({ enum: CourierConfigStatus })
  @IsOptional()
  @IsEnum(CourierConfigStatus)
  status?: CourierConfigStatus;

  @ApiPropertyOptional({ example: { apiKey: "merchant-api-key" } })
  @IsOptional()
  @IsObject()
  configData?: Record<string, unknown>;
}

export class BulkUpdateCourierConfigItemDto extends PartialType(
  UpdateCourierConfigDto,
) {
  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  id!: string;
}

export class BulkUpdateCourierConfigDto {
  @ApiProperty({ type: [BulkUpdateCourierConfigItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BulkUpdateCourierConfigItemDto)
  configs!: BulkUpdateCourierConfigItemDto[];
}

export class SeedCourierDto {
  @ApiProperty({ enum: CourierProvider })
  @IsEnum(CourierProvider)
  code!: CourierProvider;

  @ApiProperty({ example: "Pathao" })
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: CourierStatus })
  @IsOptional()
  @IsEnum(CourierStatus)
  status?: CourierStatus;
}

export class PathaoCreateStoreDto {
  @ApiProperty({ example: "Main Store" })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: "Store Manager" })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  contactName!: string;

  @ApiProperty({ example: "01700000000" })
  @IsString()
  @Length(11, 11)
  contactNumber!: string;

  @ApiPropertyOptional({ example: "01800000000" })
  @IsOptional()
  @IsString()
  @Length(11, 11)
  secondaryContact?: string;

  @ApiPropertyOptional({ example: "01700000000" })
  @IsOptional()
  @IsString()
  @Length(11, 11)
  otpNumber?: string;

  @ApiProperty({ example: "House 1, Road 2, Dhaka" })
  @IsString()
  @MinLength(10)
  @MaxLength(220)
  address!: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cityId!: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  zoneId!: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  areaId!: number;
}

export class PathaoPricePlanDto {
  @ApiProperty({ enum: [1, 2], example: 2 })
  @Type(() => Number)
  @IsIn([1, 2])
  itemType!: 1 | 2;

  @ApiProperty({ enum: [12, 48], example: 48 })
  @Type(() => Number)
  @IsIn([12, 48])
  deliveryType!: 12 | 48;

  @ApiProperty({ example: 0.5 })
  @Type(() => Number)
  @Min(0.5)
  @Max(10)
  itemWeight!: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recipientCity!: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recipientZone!: number;
}

export class StorefrontCourierQuoteDto {
  @ApiProperty({
    example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913",
    description: "Business delivery zone selected by the storefront customer",
  })
  @IsUUID()
  deliveryZoneId!: string;

  @ApiPropertyOptional({
    example: 0.5,
    description:
      "Package weight used to match configured courier shipping-charge ranges",
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  weight?: number;
}

export class PathaoBookShipmentDto {
  @ApiPropertyOptional({ enum: [12, 48], example: 48 })
  @IsOptional()
  @Type(() => Number)
  @IsIn([12, 48])
  deliveryType?: 12 | 48;

  @ApiPropertyOptional({ enum: [1, 2], example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsIn([1, 2])
  itemType?: 1 | 2;

  @ApiPropertyOptional({ example: 0.5 })
  @IsOptional()
  @Type(() => Number)
  @Min(0.5)
  @Max(10)
  itemWeight?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  itemQuantity?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recipientCity?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recipientZone?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  recipientArea?: number;

  @ApiPropertyOptional({ example: "01800000000" })
  @IsOptional()
  @IsString()
  @Length(11, 11)
  recipientSecondaryPhone?: string;

  @ApiPropertyOptional({ example: "Fragile item" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  specialInstruction?: string;

  @ApiPropertyOptional({ example: "Order items" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  itemDescription?: string;

  @ApiPropertyOptional({ enum: [0, 1], example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsIn([0, 1])
  steadfastDeliveryType?: 0 | 1;

  @ApiPropertyOptional({ example: "Mohammadpur(Dhaka)" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  redxDeliveryArea?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  redxDeliveryAreaId?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  redxPickupStoreId?: number;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  redxParcelWeight?: number;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  redxParcelValue?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  redxIsClosedBox?: boolean;
}
