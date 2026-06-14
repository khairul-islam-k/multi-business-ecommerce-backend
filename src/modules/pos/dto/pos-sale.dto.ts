import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { OrderPaymentMethod } from "@prisma/client";
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
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  taxId!: string;

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
