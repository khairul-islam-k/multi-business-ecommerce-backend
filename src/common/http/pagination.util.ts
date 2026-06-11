export type PageQuery = {
  page?: number;
  limit?: number;
};

export function getPagination(query: PageQuery) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    meta(total: number) {
      return {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      };
    },
  };
}
