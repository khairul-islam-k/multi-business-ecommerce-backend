import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class PurchaseOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getPurchaseOrderOrThrow(businessId: string, purchaseOrderId: string) {
    const purchaseOrder = await this.prisma.supplierPurchaseOrder.findFirst({
      where: { id: purchaseOrderId, businessId, deletedAt: null },
      include: { items: true },
    });

    if (!purchaseOrder) {
      throw new NotFoundException("Purchase order not found");
    }

    return purchaseOrder;
  }
}
