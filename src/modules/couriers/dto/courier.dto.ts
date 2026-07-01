import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

import {
  CourierConfigMode,
  CourierConfigStatus,
  CourierProvider,
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
