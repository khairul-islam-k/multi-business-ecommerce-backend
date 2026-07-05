import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

import { CommonStatus } from "@/database/schema";
import { ApiPropertyOptional } from "@nestjs/swagger";

import { RolePermissionDto } from "./role-permission.dto";

export class UpdateRoleDto {
  @ApiPropertyOptional({
    example: "Store Manager",
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    example: "Can manage products, orders, and employees.",
  })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({
    enum: CommonStatus,
    example: CommonStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(CommonStatus)
  status?: CommonStatus;

  @ApiPropertyOptional({
    type: [RolePermissionDto],
    description:
      "If provided, this replaces all existing permissions of the role. If omitted, permissions remain unchanged.",
    example: [
      {
        feature: "EMPLOYEE_MANAGEMENT",
        action: "READ",
      },
      {
        feature: "EMPLOYEE_MANAGEMENT",
        action: "UPDATE",
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RolePermissionDto)
  permissions?: RolePermissionDto[];
}
