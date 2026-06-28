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
  message?: string;
};

export const apiResponse = <T>(data: T, message?: string): ApiResponse<T> => ({
  data,
  message,
});

export const paginatedResponse = <T>(
  data: T[],
  meta: PaginationMeta,
  message: string,
): PaginatedApiResponse<T> => ({
  data,
  meta,
  message,
});
