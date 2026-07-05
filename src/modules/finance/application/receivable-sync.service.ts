import Decimal from "decimal.js";
import { and, eq, ne } from "drizzle-orm";

import {
  FinancePartyType,
  financeReceivable,
  FinanceReceivableStatus,
  FinanceSourceType,
} from "@/database/schema";
import { BadRequestException, Injectable } from "@nestjs/common";

import { normalizeOptionalText } from "../../../common/text/normalizers";
import { toMoney } from "../domain/money";
import { getReceivableStatus } from "../domain/receivable-status.policy";
import { FinanceCodeService } from "./finance-code.service";

import type { DatabaseTransaction } from "../../../database/database.service";

@Injectable()
export class ReceivableSyncService {
  constructor(private readonly financeCodes: FinanceCodeService) {}

  async syncOrderReceivable(
    tx: DatabaseTransaction,
    params: {
      businessId: string;
      orderId: string;
      customerId?: string | null;
      totalAmount: Decimal.Value;
      receivedAmount: Decimal.Value;
      note?: string | null;
    },
  ) {
    const totalAmount = toMoney(params.totalAmount);
    const receivedAmount = toMoney(params.receivedAmount);

    if (receivedAmount.greaterThanOrEqualTo(totalAmount)) {
      await tx
        .update(financeReceivable)
        .set({
          receivedAmount,
          status: FinanceReceivableStatus.RECEIVED,
        })
        .where(
          and(
            eq(financeReceivable.businessId, params.businessId),
            eq(financeReceivable.sourceType, FinanceSourceType.ORDER),
            eq(financeReceivable.sourceId, params.orderId),
            ne(financeReceivable.status, FinanceReceivableStatus.CANCELLED),
          ),
        );

      return null;
    }

    const [existing] = await tx
      .select()
      .from(financeReceivable)
      .where(
        and(
          eq(financeReceivable.businessId, params.businessId),
          eq(financeReceivable.sourceType, FinanceSourceType.ORDER),
          eq(financeReceivable.sourceId, params.orderId),
          ne(financeReceivable.status, FinanceReceivableStatus.CANCELLED),
        ),
      )
      .limit(1);

    const status = getReceivableStatus(totalAmount, receivedAmount);

    if (existing) {
      const [updated] = await tx
        .update(financeReceivable)
        .set({
          partyId: params.customerId ?? null,
          totalAmount,
          receivedAmount,
          status,
          note: normalizeOptionalText(params.note),
        })
        .where(eq(financeReceivable.id, existing.id))
        .returning();

      return updated;
    }

    const [created] = await tx
      .insert(financeReceivable)
      .values({
        businessId: params.businessId,
        receivableNo: await this.financeCodes.generateUniqueReceivableNo(
          params.businessId,
        ),
        partyType: FinancePartyType.CUSTOMER,
        partyId: params.customerId ?? null,
        sourceType: FinanceSourceType.ORDER,
        sourceId: params.orderId,
        totalAmount,
        receivedAmount,
        status,
        note: normalizeOptionalText(params.note),
      })
      .returning();

    return created;
  }

  async createSupplierReturnReceivable(
    tx: DatabaseTransaction,
    params: {
      businessId: string;
      supplierId: string;
      supplierReturnId: string;
      totalAmount: Decimal.Value;
      note?: string | null;
    },
  ) {
    const [existing] = await tx
      .select({ id: financeReceivable.id })
      .from(financeReceivable)
      .where(
        and(
          eq(financeReceivable.businessId, params.businessId),
          eq(financeReceivable.sourceType, FinanceSourceType.SUPPLIER_RETURN),
          eq(financeReceivable.sourceId, params.supplierReturnId),
          ne(financeReceivable.status, FinanceReceivableStatus.CANCELLED),
        ),
      )
      .limit(1);

    if (existing) {
      throw new BadRequestException(
        "Supplier return receivable already exists",
      );
    }

    const [created] = await tx
      .insert(financeReceivable)
      .values({
        businessId: params.businessId,
        receivableNo: await this.financeCodes.generateUniqueReceivableNo(
          params.businessId,
        ),
        partyType: FinancePartyType.SUPPLIER,
        partyId: params.supplierId,
        sourceType: FinanceSourceType.SUPPLIER_RETURN,
        sourceId: params.supplierReturnId,
        totalAmount: toMoney(params.totalAmount),
        receivedAmount: new Decimal(0),
        status: FinanceReceivableStatus.PENDING,
        note: normalizeOptionalText(params.note),
      })
      .returning();

    return created;
  }
}
