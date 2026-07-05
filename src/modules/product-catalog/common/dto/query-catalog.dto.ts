import { IsEnum, IsIn, IsOptional } from "class-validator";

import { ProductSimpleStatus } from "@/database/schema";
import { ApiPropertyOptional } from "@nestjs/swagger";

import { SortedPaginationQueryDto } from "../../../../common/http/query.dto";

export { SortOrder as CatalogSortOrder } from "../../../../common/http/sort.util";

export const CatalogSortBy = {
  NAME: "name",
  CREATED_AT: "createdAt",
  UPDATED_AT: "updatedAt",
} as const;
export type CatalogSortBy = (typeof CatalogSortBy)[keyof typeof CatalogSortBy];

export class QueryCatalogDto extends SortedPaginationQueryDto<CatalogSortBy> {
  @ApiPropertyOptional({ enum: ProductSimpleStatus })
  @IsOptional()
  @IsEnum(ProductSimpleStatus)
  status?: ProductSimpleStatus;

  @ApiPropertyOptional({
    enum: CatalogSortBy,
    example: CatalogSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsIn(Object.values(CatalogSortBy))
  sortBy?: CatalogSortBy = CatalogSortBy.CREATED_AT;
}
