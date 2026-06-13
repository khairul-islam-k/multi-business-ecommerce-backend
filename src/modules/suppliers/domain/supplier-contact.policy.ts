export function normalizeSupplierName(value: string) {
  return value.trim();
}

export function normalizeNullableText(value?: string | null) {
  if (value === undefined) {
    return undefined;
  }

  const normalizedValue = value?.trim();

  return normalizedValue || null;
}
