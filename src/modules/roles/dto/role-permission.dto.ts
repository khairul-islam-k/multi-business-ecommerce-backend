import { ApiProperty } from "@nestjs/swagger";
import { PermissionAction, RbacFeature } from "@/database/schema";
import { IsEnum } from "class-validator";

export class RolePermissionDto {
  @ApiProperty({
    enum: RbacFeature,
    example: RbacFeature.BUSINESS_MANAGEMENT,
  })
  @IsEnum(RbacFeature)
  feature!: RbacFeature;

  @ApiProperty({
    enum: PermissionAction,
    example: PermissionAction.READ,
  })
  @IsEnum(PermissionAction)
  action!: PermissionAction;
}
