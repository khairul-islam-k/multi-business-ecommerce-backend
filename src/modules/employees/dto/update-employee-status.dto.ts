import { IsEnum } from "class-validator";

import { ApiProperty } from "@nestjs/swagger";
import { SystemUserStatus } from "@prisma/client";

export class UpdateEmployeeStatusDto {
  @ApiProperty({
    enum: SystemUserStatus,
    example: SystemUserStatus.ACTIVE,
  })
  @IsEnum(SystemUserStatus)
  status!: SystemUserStatus;
}
