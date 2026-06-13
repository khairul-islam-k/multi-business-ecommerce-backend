import { Prisma } from "@prisma/client";

export const ORDER_INCLUDE = {
  customer: true,
  items: true,
  payments: true,
  statusLogs: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.OrderOrderInclude;
