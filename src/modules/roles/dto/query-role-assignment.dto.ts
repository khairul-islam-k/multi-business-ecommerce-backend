import { ApiPropertyOptional } from "@nestjs/swagger";
import { UserRoleMapStatus } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class QueryRoleAssignmentsDto {
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

  @ApiPropertyOptional({ example: "2d8d0f8f-95aa-4f23-a2fd-0ca6f5f8a913" })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ example: "817f7bc6-3c3b-4de8-b6df-05f9a9ab1e24" })
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @ApiPropertyOptional({
    enum: UserRoleMapStatus,
    example: UserRoleMapStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(UserRoleMapStatus)
  status?: UserRoleMapStatus;
}
