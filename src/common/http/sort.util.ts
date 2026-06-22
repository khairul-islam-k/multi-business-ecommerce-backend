import { asc, desc } from "drizzle-orm";

export type SortDirection = "asc" | "desc";

export enum SortOrder {
  ASC = "asc",
  DESC = "desc",
}

export function resolveSort<TSort extends string>(
  value: TSort | undefined,
  allowedSorts: readonly TSort[],
  fallback: TSort,
) {
  return value && allowedSorts.includes(value) ? value : fallback;
}

export function resolveSortDirection(
  value: SortDirection | undefined,
  fallback: SortDirection = "desc",
) {
  return value === "asc" || value === "desc" ? value : fallback;
}

export function resolveSortColumn<
  TSort extends string,
  TColumns extends Record<TSort, Parameters<typeof asc>[0]>,
>(value: TSort | undefined, columns: TColumns, fallback: TSort) {
  return columns[resolveSort(value, Object.keys(columns) as TSort[], fallback)];
}

export function buildOrderBy(
  column: Parameters<typeof asc>[0],
  direction: SortDirection | undefined,
  fallback: SortDirection = SortOrder.DESC,
) {
  return resolveSortDirection(direction, fallback) === SortOrder.ASC
    ? asc(column)
    : desc(column);
}
