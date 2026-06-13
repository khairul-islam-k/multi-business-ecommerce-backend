import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { buildStockItemKey } from "../../inventory/domain/stock-item-key";

export function assertPurchaseOrderItems(
  items: { productId: string; variantId?: string | null }[],
) {
  if (items.length === 0) {
    throw new BadRequestException(
      "At least one purchase order item is required",
    );
  }

  const itemKeys = new Set(
    items.map((item) => buildStockItemKey(item.productId, item.variantId)),
  );

  if (itemKeys.size !== items.length) {
    throw new BadRequestException(
      "Purchase order cannot contain duplicate items",
    );
  }
}

export function assertPurchaseReturnItems(
  items: { productId: string; variantId?: string | null }[],
) {
  if (items.length === 0) {
    throw new BadRequestException(
      "At least one purchase return item is required",
    );
  }

  const itemKeys = new Set(
    items.map((item) => buildStockItemKey(item.productId, item.variantId)),
  );

  if (itemKeys.size !== items.length) {
    throw new BadRequestException(
      "Purchase return cannot contain duplicate items",
    );
  }
}

export function calculatePurchaseReturnTotals(
  items: {
    quantity: Prisma.Decimal;
    unitCost: Prisma.Decimal;
    discountAmount: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
  }[],
) {
  return items.reduce(
    (totals, item) => ({
      subtotal: totals.subtotal.plus(item.quantity.mul(item.unitCost)),
      discountTotal: totals.discountTotal.plus(item.discountAmount),
      taxTotal: totals.taxTotal.plus(item.taxAmount),
      totalAmount: totals.totalAmount.plus(item.lineTotal),
    }),
    {
      subtotal: new Prisma.Decimal(0),
      discountTotal: new Prisma.Decimal(0),
      taxTotal: new Prisma.Decimal(0),
      totalAmount: new Prisma.Decimal(0),
    },
  );
}
