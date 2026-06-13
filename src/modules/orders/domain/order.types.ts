import { Prisma } from "@prisma/client";

import type { OrderItemInputDto } from "../dto/order.dto";

export type OrderItemWithPrice = Omit<OrderItemInputDto, "variantId"> & {
  variantId: string | null;
  unitPrice: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
};
