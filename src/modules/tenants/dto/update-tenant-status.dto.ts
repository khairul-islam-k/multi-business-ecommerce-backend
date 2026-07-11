import { IsEnum } from "class-validator";

import { SystemUserStatus } from "@/database/schema";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateTenantStatusDto {
  @ApiProperty({
    enum: SystemUserStatus,
    example: SystemUserStatus.ACTIVE,
  })
  @IsEnum(SystemUserStatus)
  status!: SystemUserStatus;
}
