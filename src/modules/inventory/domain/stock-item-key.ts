export function buildStockItemKey(
  productId: string,
  variantId?: string | null,
) {
  return variantId ? `variant:${variantId}` : `product:${productId}`;
}
