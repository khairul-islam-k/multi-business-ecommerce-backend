import { BadRequestException, Injectable } from "@nestjs/common";
import {
  supplierPurchaseOrder,
  supplierPurchaseReturn,
} from "@/database/schema";
import { and, eq } from "drizzle-orm";

import { DatabaseService } from "../../../database/database.service";
import { generateRandomCode } from "../../../common/utils/code-generator.util";
import { BusinessCodePrefixService } from "../../../common/code/business-code-prefix.service";

const SUPPLIER_CODE_RETRY_LIMIT = 5;

@Injectable()
export class SupplierCodeRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly prefixes: BusinessCodePrefixService,
  ) {}

  private get db() {
    return this.database.db;
  }

  async generateUniquePurchaseOrderNo(businessId: string) {
    const prefix = await this.prefixes.resolve(
      businessId,
      "purchaseOrderPrefix",
      "PO",
    );

    for (let attempt = 0; attempt < SUPPLIER_CODE_RETRY_LIMIT; attempt++) {
      const purchaseOrderNo = generateRandomCode(prefix);
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
    const prefix = await this.prefixes.resolve(
      businessId,
      "purchaseReturnPrefix",
      "RET",
    );

    for (let attempt = 0; attempt < SUPPLIER_CODE_RETRY_LIMIT; attempt++) {
      const returnNo = generateRandomCode(prefix);
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
