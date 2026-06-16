import { Injectable } from "@nestjs/common";
import {
  type SupplierInvoice,
  financeTax,
  supplier,
  supplierInvoice,
  supplierInvoiceItem,
  supplierPayment,
  supplierPurchaseOrder,
} from "@/database/schema";
import { asc, desc, eq } from "drizzle-orm";

import { DatabaseService } from "../../../database/database.service";

@Injectable()
export class SupplierInvoiceRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  async hydrate(invoiceRow: SupplierInvoice) {
    const [supplierRow, purchaseOrder, tax, items, payments] =
      await Promise.all([
        this.db
          .select()
          .from(supplier)
          .where(eq(supplier.id, invoiceRow.supplierId))
          .then(([row]) => row ?? null),
        invoiceRow.purchaseOrderId
          ? this.db
              .select()
              .from(supplierPurchaseOrder)
              .where(eq(supplierPurchaseOrder.id, invoiceRow.purchaseOrderId))
              .then(([row]) => row ?? null)
          : Promise.resolve(null),
        invoiceRow.taxId
          ? this.db
              .select()
              .from(financeTax)
              .where(eq(financeTax.id, invoiceRow.taxId))
              .then(([row]) => row ?? null)
          : Promise.resolve(null),
        this.db
          .select()
          .from(supplierInvoiceItem)
          .where(eq(supplierInvoiceItem.supplierInvoiceId, invoiceRow.id))
          .orderBy(asc(supplierInvoiceItem.createdAt)),
        this.db
          .select()
          .from(supplierPayment)
          .where(eq(supplierPayment.supplierInvoiceId, invoiceRow.id))
          .orderBy(desc(supplierPayment.createdAt)),
      ]);

    return {
      ...invoiceRow,
      supplier: supplierRow,
      purchaseOrder,
      tax,
      items,
      payments,
    };
  }
}
