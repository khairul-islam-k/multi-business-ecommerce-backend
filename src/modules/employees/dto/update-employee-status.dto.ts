import { ApiProperty } from "@nestjs/swagger";
import { SystemUserStatus } from "@/database/schema";
import { IsEnum } from "class-validator";

export class UpdateEmployeeStatusDto {
  @ApiProperty({
    enum: SystemUserStatus,
    example: SystemUserStatus.ACTIVE,
  })
  @IsEnum(SystemUserStatus)
  status!: SystemUserStatus;
}
