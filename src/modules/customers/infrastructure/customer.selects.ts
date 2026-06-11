import { Prisma } from "@prisma/client";

export const CUSTOMER_INCLUDE = {
  addresses: {
    where: { deletedAt: null },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  },
  _count: {
    select: {
      carts: true,
      orders: true,
    },
  },
} satisfies Prisma.OrderCustomerInclude;

export const CUSTOMER_ORDER_INCLUDE = {
  items: { orderBy: { createdAt: "asc" } },
  payments: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.OrderOrderInclude;
