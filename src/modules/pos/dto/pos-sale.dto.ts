import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from "class-validator";

import { OrderPaymentMethod } from "@/database/schema";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { OrderItemInputDto } from "../../orders/dto/order.dto";

export class PosPaymentDto {
  @ApiProperty({ enum: OrderPaymentMethod, example: OrderPaymentMethod.CASH })
  @IsEnum(OrderPaymentMethod)
  paymentMethod!: OrderPaymentMethod;

  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  financeAccountId!: string;
}

export class CreatePosSaleDto {
  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  warehouseId!: string;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  customerId?: string;

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

  @ApiPropertyOptional({ example: "jane@example.com" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  customerEmail?: string;

  @ApiProperty({ type: [OrderItemInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items!: OrderItemInputDto[];

  @ApiProperty({ type: PosPaymentDto })
  @ValidateNested()
  @Type(() => PosPaymentDto)
  payment!: PosPaymentDto;
}
