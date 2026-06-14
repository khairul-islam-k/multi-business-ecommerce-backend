import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, ValidateNested } from "class-validator";

import { PermissionItemDto } from "./permission-item.dto";

export class UpdatePermissionDto {
  @ApiProperty({
    type: [PermissionItemDto],
    description:
      "Full replacement list. Send an empty array to remove all permissions from the role.",
    example: [
      {
        feature: "ROLE_PERMISSION_MANAGEMENT",
        action: "READ",
      },
      {
        feature: "ROLE_PERMISSION_MANAGEMENT",
        action: "UPDATE",
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionItemDto)
  permissions: PermissionItemDto[] = [];
}
