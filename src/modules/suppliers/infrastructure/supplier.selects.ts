import { Prisma } from "@prisma/client";

export const SUPPLIER_INCLUDE = {
  _count: {
    select: {
      products: true,
      orders: true,
    },
  },
} satisfies Prisma.SupplierInclude;

export const PURCHASE_ORDER_INCLUDE = {
  supplier: true,
  tax: true,
  items: {
    orderBy: { createdAt: "asc" },
    include: {
      product: {
        include: {
          productStocks: true,
        },
      },
      variant: {
        include: { variantStocks: true },
      },
    },
  },
  invoices: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.SupplierPurchaseOrderInclude;

export const SUPPLIER_INVOICE_INCLUDE = {
  supplier: true,
  purchaseOrder: true,
  tax: true,
  items: { orderBy: { createdAt: "asc" } },
  payments: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.SupplierInvoiceInclude;

export const PURCHASE_RETURN_INCLUDE = {
  supplier: true,
  purchaseOrder: true,
  supplierInvoice: true,
  tax: true,
  items: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.SupplierPurchaseReturnInclude;
