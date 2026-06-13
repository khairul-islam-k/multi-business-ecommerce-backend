import { Prisma } from "@prisma/client";

export const VARIANT_INCLUDE = {
  product: {
    select: { name: true, price: true },
  },
  attributes: {
    include: {
      attribute: true,
      attributeValue: true,
    },
    orderBy: { createdAt: "asc" },
  },
  images: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
} satisfies Prisma.ProductVariantInclude;
