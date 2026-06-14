import { BadRequestException, Injectable } from "@nestjs/common";
import {
  FinancePartyType,
  FinanceReceivableStatus,
  FinanceSourceType,
  Prisma,
} from "@prisma/client";

import { toMoney } from "../domain/money";
import { getReceivableStatus } from "../domain/receivable-status.policy";
import { FinanceCodeService } from "./finance-code.service";
import { normalizeOptionalText } from "../../../common/text/normalizers";

@Injectable()
export class ReceivableSyncService {
  constructor(private readonly financeCodes: FinanceCodeService) {}

  async syncOrderReceivable(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      orderId: string;
      customerId?: string | null;
      totalAmount: Prisma.Decimal.Value;
      receivedAmount: Prisma.Decimal.Value;
      note?: string | null;
    },
  ) {
    const totalAmount = toMoney(params.totalAmount);
    const receivedAmount = toMoney(params.receivedAmount);

    if (receivedAmount.greaterThanOrEqualTo(totalAmount)) {
      await tx.financeReceivable.updateMany({
        where: {
          businessId: params.businessId,
          sourceType: FinanceSourceType.ORDER,
          sourceId: params.orderId,
          status: {
            not: FinanceReceivableStatus.CANCELLED,
          },
        },
        data: {
          receivedAmount,
          status: FinanceReceivableStatus.RECEIVED,
        },
      });

      return null;
    }

    const existing = await tx.financeReceivable.findFirst({
      where: {
        businessId: params.businessId,
        sourceType: FinanceSourceType.ORDER,
        sourceId: params.orderId,
        status: {
          not: FinanceReceivableStatus.CANCELLED,
        },
      },
    });

    const status = getReceivableStatus(totalAmount, receivedAmount);

    if (existing) {
      return tx.financeReceivable.update({
        where: { id: existing.id },
        data: {
          partyId: params.customerId ?? null,
          totalAmount,
          receivedAmount,
          status,
          note: normalizeOptionalText(params.note),
        },
      });
    }

    return tx.financeReceivable.create({
      data: {
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
      },
    });
  }

  async createSupplierReturnReceivable(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      supplierId: string;
      supplierReturnId: string;
      totalAmount: Prisma.Decimal.Value;
      note?: string | null;
    },
  ) {
    const existing = await tx.financeReceivable.findFirst({
      where: {
        businessId: params.businessId,
        sourceType: FinanceSourceType.SUPPLIER_RETURN,
        sourceId: params.supplierReturnId,
        status: {
          not: FinanceReceivableStatus.CANCELLED,
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException(
        "Supplier return receivable already exists",
      );
    }

    return tx.financeReceivable.create({
      data: {
        businessId: params.businessId,
        receivableNo: await this.financeCodes.generateUniqueReceivableNo(
          params.businessId,
        ),
        partyType: FinancePartyType.SUPPLIER,
        partyId: params.supplierId,
        sourceType: FinanceSourceType.SUPPLIER_RETURN,
        sourceId: params.supplierReturnId,
        totalAmount: params.totalAmount,
        receivedAmount: 0,
        status: FinanceReceivableStatus.PENDING,
        note: normalizeOptionalText(params.note),
      },
    });
  }
}
