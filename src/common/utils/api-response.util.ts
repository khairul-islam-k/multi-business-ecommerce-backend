export type ApiResponse<T> = {
  data: T;
  message?: string;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PaginatedApiResponse<T> = {
  data: T[];
  meta: PaginationMeta;
};

export const apiResponse = <T>(data: T, message?: string): ApiResponse<T> => ({
  data,
  message,
});

export const paginatedResponse = <T>(
  data: T[],
  meta: PaginationMeta,
): PaginatedApiResponse<T> => ({
  data,
  meta,
});
