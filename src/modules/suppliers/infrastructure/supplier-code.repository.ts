import { BadRequestException, Injectable } from "@nestjs/common";
import {
  supplierPurchaseOrder,
  supplierPurchaseReturn,
} from "@/database/schema";
import { and, eq } from "drizzle-orm";

import { DatabaseService } from "../../../database/database.service";
import { generateRandomCode } from "../../../common/utils/code-generator.util";

const SUPPLIER_CODE_RETRY_LIMIT = 5;

@Injectable()
export class SupplierCodeRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  async generateUniquePurchaseOrderNo(businessId: string) {
    for (let attempt = 0; attempt < SUPPLIER_CODE_RETRY_LIMIT; attempt++) {
      const purchaseOrderNo = generateRandomCode("PO");
      const [existingPurchaseOrder] = await this.db
        .select({ id: supplierPurchaseOrder.id })
        .from(supplierPurchaseOrder)
        .where(
          and(
            eq(supplierPurchaseOrder.businessId, businessId),
            eq(supplierPurchaseOrder.purchaseOrderNo, purchaseOrderNo),
          ),
        );

      if (!existingPurchaseOrder) {
        return purchaseOrderNo;
      }
    }

    throw new BadRequestException("Could not generate purchase order number");
  }

  async generateUniqueReturnNo(businessId: string) {
    for (let attempt = 0; attempt < SUPPLIER_CODE_RETRY_LIMIT; attempt++) {
      const returnNo = generateRandomCode("RET");
      const [existingReturn] = await this.db
        .select({ id: supplierPurchaseReturn.id })
        .from(supplierPurchaseReturn)
        .where(
          and(
            eq(supplierPurchaseReturn.businessId, businessId),
            eq(supplierPurchaseReturn.returnNo, returnNo),
          ),
        );

      if (!existingReturn) {
        return returnNo;
      }
    }

    throw new BadRequestException("Could not generate purchase return number");
  }
}
