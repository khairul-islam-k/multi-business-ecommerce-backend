export function buildStockItemKey(
  productId: string,
  variantId?: string | null,
) {
  return variantId ?? `product:${productId}`;
}
