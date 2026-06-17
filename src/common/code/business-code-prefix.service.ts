import { Injectable } from "@nestjs/common";
import { businessSetting } from "@/database/schema";
import { eq } from "drizzle-orm";

import { DatabaseService } from "../../database/database.service";

export type BusinessCodePrefixField =
  | "orderPrefix"
  | "invoicePrefix"
  | "paymentPrefix"
  | "shipmentPrefix"
  | "purchaseOrderPrefix"
  | "purchaseReturnPrefix"
  | "stockAdjustmentPrefix"
  | "stockTransferPrefix"
  | "expensePrefix"
  | "supplierInvoicePrefix"
  | "supplierPaymentPrefix"
  | "receivablePrefix"
  | "payablePrefix"
  | "transactionPrefix"
  | "productSkuPrefix"
  | "productBarcodePrefix"
  | "variantSkuPrefix"
  | "variantBarcodePrefix";

@Injectable()
export class BusinessCodePrefixService {
  constructor(private readonly database: DatabaseService) {}

  async resolve(
    businessId: string,
    field: BusinessCodePrefixField,
    fallback: string,
  ) {
    const [settings] = await this.database.db
      .select({ value: businessSetting[field] })
      .from(businessSetting)
      .where(eq(businessSetting.businessId, businessId))
      .limit(1);
    const configured = settings?.value?.trim();

    return configured || fallback;
  }
}
