export type SortDirection = "asc" | "desc";

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
