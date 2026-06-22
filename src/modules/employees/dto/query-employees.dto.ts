import { ApiPropertyOptional } from "@nestjs/swagger";
import { SystemUserStatus } from "@/database/schema";
import { Type } from "class-transformer";
import { IsBoolean, IsEnum, IsIn, IsOptional } from "class-validator";

import { SortedPaginationQueryDto } from "../../../common/http/query.dto";

export const EmployeeSortBy = {
  NAME: "name",
  EMAIL: "email",
  STATUS: "status",
  CREATED_AT: "createdAt",
  UPDATED_AT: "updatedAt",
} as const;
export type EmployeeSortBy =
  (typeof EmployeeSortBy)[keyof typeof EmployeeSortBy];

export class QueryEmployeesDto extends SortedPaginationQueryDto<EmployeeSortBy> {
  @ApiPropertyOptional({
    enum: SystemUserStatus,
    example: SystemUserStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(SystemUserStatus)
  status?: SystemUserStatus;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeDeleted?: boolean;

  @ApiPropertyOptional({
    enum: EmployeeSortBy,
    example: "createdAt",
  })
  @IsOptional()
  @IsIn(Object.values(EmployeeSortBy))
  sortBy?: EmployeeSortBy = EmployeeSortBy.CREATED_AT;
}
