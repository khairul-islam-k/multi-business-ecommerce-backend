import { ApiPropertyOptional } from "@nestjs/swagger";
import { CommonStatus } from "@/database/schema";
import { Type } from "class-transformer";
import { IsBoolean, IsEnum, IsIn, IsOptional } from "class-validator";

import { SortedPaginationQueryDto } from "../../../common/http/query.dto";

export const RoleSortBy = {
  NAME: "name",
  STATUS: "status",
  CREATED_AT: "createdAt",
  UPDATED_AT: "updatedAt",
} as const;
export type RoleSortBy = (typeof RoleSortBy)[keyof typeof RoleSortBy];

export class QueryRoleDto extends SortedPaginationQueryDto<RoleSortBy> {
  @ApiPropertyOptional({
    enum: CommonStatus,
    example: CommonStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(CommonStatus)
  status?: CommonStatus;

  @ApiPropertyOptional({
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeDeleted?: boolean;

  @ApiPropertyOptional({
    enum: RoleSortBy,
    example: "createdAt",
  })
  @IsOptional()
  @IsIn(Object.values(RoleSortBy))
  sortBy?: RoleSortBy = RoleSortBy.CREATED_AT;
}
