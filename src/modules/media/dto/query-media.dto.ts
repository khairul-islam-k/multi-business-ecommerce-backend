import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";

import { SortedPaginationQueryDto } from "../../../common/http/query.dto";

export const MediaSortBy = {
  CREATED_AT: "createdAt",
  FILE_NAME: "fileName",
  FILE_SIZE: "fileSize",
} as const;
export type MediaSortBy = (typeof MediaSortBy)[keyof typeof MediaSortBy];

export class QueryMediaDto extends SortedPaginationQueryDto<MediaSortBy> {
  @ApiPropertyOptional({
    example: "hero,banner",
    description: "Comma-separated tags. Returns images matching any tag.",
  })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({
    example: "createdAt",
    enum: MediaSortBy,
  })
  @IsOptional()
  @IsIn(Object.values(MediaSortBy))
  sortBy?: MediaSortBy = MediaSortBy.CREATED_AT;
}
