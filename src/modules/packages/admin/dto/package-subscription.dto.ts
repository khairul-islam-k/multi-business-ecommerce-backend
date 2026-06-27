import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

import { PackageSubscriptionStatus } from "@/database/schema";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class QueryPackageSubscriptionDto {
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

  @ApiPropertyOptional({
    enum: PackageSubscriptionStatus,
    example: PackageSubscriptionStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(PackageSubscriptionStatus)
  status?: PackageSubscriptionStatus;

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class CreateTenantSubscriptionDto {
  @ApiProperty({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsUUID()
  tenantId!: string;

  @ApiProperty({ example: "8f375e53-4a7e-49dd-ae7c-3a5d429c7963" })
  @IsUUID()
  planId!: string;
}

export class ChangeTenantSubscriptionPlanDto {
  @ApiProperty({ example: "8f375e53-4a7e-49dd-ae7c-3a5d429c7963" })
  @IsUUID()
  planId!: string;
}

export class CancelPackageSubscriptionDto {
  @ApiPropertyOptional({ example: "Requested by tenant" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
