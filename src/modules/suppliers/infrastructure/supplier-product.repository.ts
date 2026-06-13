import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class SupplierProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  async assertSupplierProductMapExists(
    businessId: string,
    supplierId: string,
    productMapId: string,
  ) {
    const productMap = await this.prisma.supplierProductMap.findFirst({
      where: { id: productMapId, businessId, supplierId },
      select: { id: true, productId: true, variantId: true },
    });

    if (!productMap) {
      throw new NotFoundException("Supplier product not found");
    }

    return productMap;
  }
}
