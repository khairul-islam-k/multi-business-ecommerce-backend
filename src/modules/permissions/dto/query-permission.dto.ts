import { ApiPropertyOptional } from "@nestjs/swagger";
import { PermissionAction, RbacFeature } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class QueryPermissionDto {
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

  @ApiPropertyOptional({ example: "817f7bc6-3c3b-4de8-b6df-05f9a9ab1e24" })
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @ApiPropertyOptional({
    enum: RbacFeature,
    example: RbacFeature.BUSINESS_MANAGEMENT,
  })
  @IsOptional()
  @IsEnum(RbacFeature)
  feature?: RbacFeature;

  @ApiPropertyOptional({
    enum: PermissionAction,
    example: PermissionAction.READ,
  })
  @IsOptional()
  @IsEnum(PermissionAction)
  action?: PermissionAction;
}
