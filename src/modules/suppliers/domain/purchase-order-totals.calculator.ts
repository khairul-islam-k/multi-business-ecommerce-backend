import Decimal from "decimal.js";

export type PurchaseOrderTotalItem = {
  quantityOrdered: number;
  unitCost: number;
  discountAmount?: number;
};

export function calculatePurchaseOrderTotals(
  items: PurchaseOrderTotalItem[],
  shippingCost: number,
  taxRate: Decimal.Value,
) {
  const subtotal = items.reduce(
    (total, item) => total + item.quantityOrdered * item.unitCost,
    0,
  );
  const discountTotal = items.reduce(
    (total, item) => total + (item.discountAmount ?? 0),
    0,
  );
  const taxTotal = items.reduce(
    (total, item) => total + Number(calculateLineTax(item, taxRate).toString()),
    0,
  );

  return {
    subtotal,
    discountTotal,
    taxTotal,
    shippingCost,
    totalAmount: subtotal - discountTotal + taxTotal + shippingCost,
  };
}

export function calculateLineTotal(
  item: PurchaseOrderTotalItem,
  taxRate: Decimal.Value,
) {
  const subtotal = new Decimal(item.quantityOrdered).mul(item.unitCost);
  const discountAmount = new Decimal(item.discountAmount ?? 0);

  return subtotal.minus(discountAmount).plus(calculateLineTax(item, taxRate));
}

export function calculateLineTax(
  item: PurchaseOrderTotalItem,
  taxRate: Decimal.Value,
) {
  const subtotal = new Decimal(item.quantityOrdered).mul(item.unitCost);
  const discountAmount = new Decimal(item.discountAmount ?? 0);
  const taxableAmount = subtotal.minus(discountAmount);

  return taxableAmount.mul(taxRate).div(100).toDecimalPlaces(2);
}

