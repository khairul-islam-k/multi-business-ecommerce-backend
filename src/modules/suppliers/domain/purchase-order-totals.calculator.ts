import Decimal from "decimal.js";

export type PurchaseOrderTotalItem = {
  quantityOrdered: number;
  unitCost: number;
  discountAmount?: number;
  taxRate: Decimal.Value;
};

export function calculatePurchaseOrderTotals(
  items: PurchaseOrderTotalItem[],
  shippingCost: number,
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
    (total, item) => total + Number(calculateLineTax(item).toString()),
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
) {
  const subtotal = new Decimal(item.quantityOrdered).mul(item.unitCost);
  const discountAmount = new Decimal(item.discountAmount ?? 0);

  return subtotal.minus(discountAmount).plus(calculateLineTax(item));
}

export function calculateLineTax(item: PurchaseOrderTotalItem) {
  const subtotal = new Decimal(item.quantityOrdered).mul(item.unitCost);
  const discountAmount = new Decimal(item.discountAmount ?? 0);
  const taxableAmount = subtotal.minus(discountAmount);

  return taxableAmount.mul(item.taxRate).div(100).toDecimalPlaces(2);
}

