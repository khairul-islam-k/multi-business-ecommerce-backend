import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  FinancePartyType,
  FinancePayableStatus,
  FinanceSourceType,
  financePayable,
} from "@/database/schema";
import Decimal from "decimal.js";
import { and, eq, ne } from "drizzle-orm";

import { toMoney } from "../domain/money";
import { getPayableStatus } from "../domain/payable-status.policy";
import { FinanceCodeService } from "./finance-code.service";
import { normalizeOptionalText } from "../../../common/text/normalizers";
import type { DatabaseTransaction } from "../../../database/database.service";

@Injectable()
export class PayableSyncService {
  constructor(private readonly financeCodes: FinanceCodeService) {}

  async createSupplierInvoicePayable(
    tx: DatabaseTransaction,
    params: {
      businessId: string;
      supplierId: string;
      supplierInvoiceId: string;
      totalAmount: Decimal.Value;
      note?: string | null;
    },
  ) {
    const [existing] = await tx
      .select({ id: financePayable.id })
      .from(financePayable)
      .where(
        and(
          eq(financePayable.businessId, params.businessId),
          eq(financePayable.sourceType, FinanceSourceType.SUPPLIER_INVOICE),
          eq(financePayable.sourceId, params.supplierInvoiceId),
          ne(financePayable.status, FinancePayableStatus.CANCELLED),
        ),
      )
      .limit(1);

    if (existing) {
      throw new BadRequestException("Supplier invoice payable already exists");
    }

    const [created] = await tx
      .insert(financePayable)
      .values({
        businessId: params.businessId,
        payableNo: await this.financeCodes.generateUniquePayableNo(
          params.businessId,
        ),
        partyType: FinancePartyType.SUPPLIER,
        partyId: params.supplierId,
        sourceType: FinanceSourceType.SUPPLIER_INVOICE,
        sourceId: params.supplierInvoiceId,
        totalAmount: toMoney(params.totalAmount),
        paidAmount: new Decimal(0),
        status: FinancePayableStatus.PENDING,
        note: normalizeOptionalText(params.note),
      })
      .returning();

    return created;
  }

  async syncSupplierInvoicePayablePayment(
    tx: DatabaseTransaction,
    params: {
      businessId: string;
      supplierInvoiceId: string;
      paidAmount: Decimal.Value;
    },
  ) {
    const [payable] = await tx
      .select()
      .from(financePayable)
      .where(
        and(
          eq(financePayable.businessId, params.businessId),
          eq(financePayable.sourceType, FinanceSourceType.SUPPLIER_INVOICE),
          eq(financePayable.sourceId, params.supplierInvoiceId),
          ne(financePayable.status, FinancePayableStatus.CANCELLED),
        ),
      )
      .limit(1);

    if (!payable) {
      throw new NotFoundException("Supplier invoice payable not found");
    }

    const paidAmount = toMoney(params.paidAmount);
    const status = getPayableStatus(payable.totalAmount, paidAmount);
    const [updated] = await tx
      .update(financePayable)
      .set({
        paidAmount,
        status,
      })
      .where(eq(financePayable.id, payable.id))
      .returning();

    return updated;
  }
}
