import { ApiProperty } from "@nestjs/swagger";
import { SystemUserStatus } from "@/database/schema";
import { IsEnum } from "class-validator";

export class UpdateTenantStatusDto {
  @ApiProperty({
    enum: SystemUserStatus,
    example: SystemUserStatus.ACTIVE,
  })
  @IsEnum(SystemUserStatus)
  status!: SystemUserStatus;
}
