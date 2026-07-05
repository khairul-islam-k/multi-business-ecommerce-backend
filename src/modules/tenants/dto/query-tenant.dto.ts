import { ApiPropertyOptional } from "@nestjs/swagger";
import { SystemUserStatus } from "@/database/schema";
import { IsEnum, IsIn, IsOptional } from "class-validator";

import { SortedPaginationQueryDto } from "../../../common/http/query.dto";

export const TenantSortBy = {
  ID: "id",
  NAME: "name",
  STATUS: "status",
  CREATED_AT: "createdAt",
  UPDATED_AT: "updatedAt",
} as const;
export type TenantSortBy = (typeof TenantSortBy)[keyof typeof TenantSortBy];

export class QueryTenantDto extends SortedPaginationQueryDto<TenantSortBy> {
  @ApiPropertyOptional({ enum: SystemUserStatus })
  @IsOptional()
  @IsEnum(SystemUserStatus)
  status?: SystemUserStatus;

  @ApiPropertyOptional({
    example: "createdAt",
    enum: TenantSortBy,
  })
  @IsOptional()
  @IsIn(Object.values(TenantSortBy))
  sortBy?: TenantSortBy = TenantSortBy.CREATED_AT;
}
