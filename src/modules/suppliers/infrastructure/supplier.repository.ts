import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { SupplierStatus } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class SupplierRepository {
  constructor(private readonly prisma: PrismaService) {}

  async assertSupplierExists(
    businessId: string,
    supplierId: string,
    requireActive = false,
  ) {
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: supplierId,
        businessId,
        deletedAt: null,
        ...(requireActive ? { status: SupplierStatus.ACTIVE } : {}),
      },
      select: { id: true },
    });

    if (!supplier) {
      throw new NotFoundException("Supplier not found");
    }
  }

  async assertSupplierCanBeDeleted(businessId: string, supplierId: string) {
    const referenceCounts = await Promise.all([
      this.prisma.supplierPurchaseOrder.count({
        where: { businessId, supplierId, deletedAt: null },
      }),
      this.prisma.supplierInvoice.count({
        where: { businessId, supplierId, deletedAt: null },
      }),
    ]);

    if (referenceCounts.some((count) => count > 0)) {
      throw new BadRequestException(
        "Supplier cannot be deleted while referenced by purchase records",
      );
    }
  }
}
