import { isUUID } from "class-validator";

export function normalizeSearch(value?: string | null) {
  const search = value?.trim();

  return search || undefined;
}

export function normalizeSearchUuid(value?: string | null) {
  const search = normalizeSearch(value);

  return search && isUUID(search) ? search : undefined;
}
