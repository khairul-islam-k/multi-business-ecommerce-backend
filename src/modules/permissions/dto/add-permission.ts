import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, ValidateNested } from "class-validator";

import { PermissionItemDto } from "./permission-item.dto";

export class AddPermissionDto {
  @ApiProperty({
    type: [PermissionItemDto],
    example: [
      {
        feature: "BUSINESS_MANAGEMENT",
        action: "READ",
      },
      {
        feature: "BUSINESS_MANAGEMENT",
        action: "UPDATE",
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PermissionItemDto)
  permissions!: PermissionItemDto[];
}
