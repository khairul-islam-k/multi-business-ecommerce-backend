import { Prisma } from "@prisma/client";

export const PRODUCT_INCLUDE = {
  category: true,
  brand: true,
  unit: true,
  tags: { include: { tag: true } },
  images: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
  variants: {
    where: { deletedAt: null },
    include: {
      attributes: {
        include: {
          attribute: true,
          attributeValue: true,
        },
        orderBy: { createdAt: "asc" },
      },
      images: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
    },
  },
} satisfies Prisma.ProductInclude;
