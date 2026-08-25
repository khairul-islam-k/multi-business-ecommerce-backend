import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

import {
  CourierConfigMode,
  CourierConfigStatus,
  CourierProvider,
  CourierShipmentStatus,
  CourierStatus,
} from "@/database/schema";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { SearchablePaginationQueryDto } from "../../../common/http/query.dto";

export class QueryCourierDto extends SearchablePaginationQueryDto {
  @ApiPropertyOptional({ enum: CourierProvider })
  @IsOptional()
  @IsEnum(CourierProvider)
  provider?: CourierProvider;

  @ApiPropertyOptional({ enum: CourierStatus })
  @IsOptional()
  @IsEnum(CourierStatus)
  status?: CourierStatus;
}

export class QueryCourierConfigDto extends SearchablePaginationQueryDto {
  @ApiPropertyOptional({ enum: CourierConfigStatus })
  @IsOptional()
  @IsEnum(CourierConfigStatus)
  status?: CourierConfigStatus;
}

export class QueryCourierShipmentDto extends SearchablePaginationQueryDto {
  @ApiPropertyOptional({ enum: CourierShipmentStatus })
  @IsOptional()
  @IsEnum(CourierShipmentStatus)
  status?: CourierShipmentStatus;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  courierId?: string;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  courierConfigId?: string;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  pickupWarehouseId?: string;
}

export class UpdateCourierConfigDto {
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  configData?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: CourierConfigMode })
  @IsOptional()
  @IsEnum(CourierConfigMode)
  mode?: CourierConfigMode;

  @ApiPropertyOptional({ enum: CourierConfigStatus })
  @IsOptional()
  @IsEnum(CourierConfigStatus)
  status?: CourierConfigStatus;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  rotateWebhookToken?: boolean;
}

export class BulkUpdateCourierConfigItem extends UpdateCourierConfigDto {
  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  configId!: string;
}

export class BulkUpdateCourierConfigDto {
  @ApiProperty({ type: [BulkUpdateCourierConfigItem] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BulkUpdateCourierConfigItem)
  configs!: BulkUpdateCourierConfigItem[];
}

export class RedxAreaQueryDto {
  @ApiPropertyOptional({
    example: "1209",
    description: "Postal code for redx",
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postCode?: string;

  @ApiPropertyOptional({
    example: "Dhaka",
    description: "district name code for redx",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  districtName?: string;
}

export class RedxChargeQuoteDto {
  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiProperty({ example: "115" })
  @IsString()
  @MaxLength(80)
  deliveryCityId!: string;

  @ApiProperty({ example: "115" })
  @IsString()
  @IsOptional()
  @MaxLength(80)
  deliveryZoneId?: string;

  @ApiPropertyOptional({ example: "Dhanmondi" })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  deliveryAreaName?: string;

  @ApiPropertyOptional({ example: "1209" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  deliveryPostCode?: string;

  @ApiPropertyOptional({ example: "Dhaka" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deliveryDivisionName?: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight!: number;
}

export class StorefrontCourierQuoteDto extends RedxChargeQuoteDto {
  @ApiPropertyOptional({ example: "Please call before delivery" })
  @IsOptional()
  @IsString()
  specialInstruction?: string;
}

export class StorefrontCourierSelectionDto {
  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiProperty({ example: "115" })
  @IsString()
  @MaxLength(255)
  deliveryCityId!: string;

  @ApiProperty({ example: "115" })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  deliveryZoneId?: string;

  @ApiPropertyOptional({ example: "Dhanmondi" })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  deliveryAreaName?: string;

  @ApiPropertyOptional({ example: "1209" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  deliveryPostCode?: string;

  @ApiPropertyOptional({ example: "Dhaka" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deliveryDivisionName?: string;

  @ApiPropertyOptional({ example: "01737623568" })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiPropertyOptional({ example: "Please call before delivery" })
  @IsOptional()
  @IsString()
  specialInstruction?: string;
}

export class AssignCourierToOrderDto extends StorefrontCourierSelectionDto {
  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  courierConfigId!: string;
}

export class RedxCreatePickupStoreDto {
  @ApiProperty({ example: "Default Warehouse" })
  @IsString()
  @MaxLength(150)
  name!: string;

  @ApiProperty({ example: "Default Warehouse" })
  @IsString()
  @IsOptional()
  @MaxLength(150)
  contactName!: string;

  @ApiProperty({ example: "+8801700000000" })
  @IsString()
  @MaxLength(30)
  phone!: string;

  @ApiProperty({ example: "House 10, Road 2, Dhaka" })
  @IsString()
  address!: string;

  @ApiPropertyOptional({ example: "115" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  cityId?: string;

  @ApiPropertyOptional({ example: "115" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  zoneId?: string;

  @ApiProperty({ example: "115" })
  @IsString()
  @IsOptional()
  @MaxLength(80)
  areaId!: string;
}

export class RedxUpdatePickupStoreDto {
  @ApiPropertyOptional({ example: "Default Warehouse" })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ example: "+8801700000000" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: "House 10, Road 2, Dhaka" })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: "115" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  areaId?: string;
}

export class RedxWebhookDto {
  @ApiPropertyOptional({ example: "22A123456789" })
  @IsOptional()
  @IsString()
  tracking_number?: string;

  @ApiPropertyOptional({ example: "delivered" })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: "OC-SHP-1001" })
  @IsOptional()
  @IsString()
  invoice_number?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  raw?: Record<string, unknown>;
}
