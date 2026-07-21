import Decimal from "decimal.js";

type ProductOfferPricingInput = {
  price: Decimal.Value;
  inOffer?: boolean | null;
  offerPrice?: Decimal.Value | null;
  startingFrom?: Date | null;
  endsIn?: Date | null;
};

export function isProductOfferActive(
  product: ProductOfferPricingInput,
  now = new Date(),
) {
  if (product.inOffer !== true || product.offerPrice == null) {
    return false;
  }

  if (!product.startingFrom || !product.endsIn) {
    return false;
  }

  return product.startingFrom <= now && product.endsIn >= now;
}

export function resolveProductEffectivePrice(
  product: ProductOfferPricingInput,
  now = new Date(),
) {
  return isProductOfferActive(product, now)
    ? new Decimal(product.offerPrice!)
    : new Decimal(product.price);
}
