import { Type } from "class-transformer";
import { IsDate, IsEnum, IsOptional } from "class-validator";

import { UserRoleMapStatus } from "@/database/schema";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateRoleAssignmentDto {
  @ApiPropertyOptional({
    enum: UserRoleMapStatus,
    example: UserRoleMapStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(UserRoleMapStatus)
  status?: UserRoleMapStatus;

  @ApiPropertyOptional({
    example: "2026-12-31T23:59:59.000Z",
    nullable: true,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date | null;
}
