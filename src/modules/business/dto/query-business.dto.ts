import { ApiPropertyOptional } from "@nestjs/swagger";
import { BusinessStatus } from "@/database/schema";
import { Type } from "class-transformer";
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString } from "class-validator";

import { SortedPaginationQueryDto } from "../../../common/http/query.dto";

export const BusinessSortBy = {
  ID: "id",
  NAME: "name",
  STATUS: "status",
  CREATED_AT: "createdAt",
  UPDATED_AT: "updatedAt",
} as const;
export type BusinessSortBy =
  (typeof BusinessSortBy)[keyof typeof BusinessSortBy];

export class QueryBusinessDto extends SortedPaginationQueryDto<BusinessSortBy> {
  @ApiPropertyOptional({ enum: BusinessStatus })
  @IsOptional()
  @IsEnum(BusinessStatus)
  status?: BusinessStatus;

  @ApiPropertyOptional({ example: "BDT" })
  @IsOptional()
  @IsString()
  currencyCode?: string;

  @ApiPropertyOptional({ example: "Bangladesh" })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    example: "createdAt",
    enum: BusinessSortBy,
  })
  @IsOptional()
  @IsIn(Object.values(BusinessSortBy))
  sortBy?: BusinessSortBy = BusinessSortBy.CREATED_AT;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeDeleted?: boolean = false;
}
