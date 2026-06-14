import { BadRequestException, Injectable } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";
import { generateRandomCode } from "../../../common/utils/code-generator.util";

const SUPPLIER_CODE_RETRY_LIMIT = 5;

@Injectable()
export class SupplierCodeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async generateUniquePurchaseOrderNo(businessId: string) {
    for (let attempt = 0; attempt < SUPPLIER_CODE_RETRY_LIMIT; attempt++) {
      const purchaseOrderNo = generateRandomCode("PO");

      const existingPurchaseOrder =
        await this.prisma.supplierPurchaseOrder.findFirst({
          where: {
            businessId,
            purchaseOrderNo,
          },
          select: { id: true },
        });

      if (!existingPurchaseOrder) {
        return purchaseOrderNo;
      }
    }

    throw new BadRequestException("Could not generate purchase order number");
  }

  async generateUniqueReturnNo(businessId: string) {
    for (let attempt = 0; attempt < SUPPLIER_CODE_RETRY_LIMIT; attempt++) {
      const returnNo = generateRandomCode("RET");

      const existingReturn = await this.prisma.supplierPurchaseReturn.findFirst(
        {
          where: {
            businessId,
            returnNo,
          },
          select: { id: true },
        },
      );

      if (!existingReturn) {
        return returnNo;
      }
    }

    throw new BadRequestException("Could not generate purchase return number");
  }
}
