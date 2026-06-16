import Decimal from "decimal.js";

import type { OrderItemInputDto } from "../dto/order.dto";

export type OrderItemWithPrice = Omit<OrderItemInputDto, "variantId"> & {
  variantId: string | null;
  unitPrice: Decimal;
  taxAmount: Decimal;
  lineTotal: Decimal;
};

