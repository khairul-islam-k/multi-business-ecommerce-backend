import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  FinancePartyType,
  FinancePayableStatus,
  FinanceSourceType,
  Prisma,
} from "@prisma/client";

import { normalizeOptionalText } from "../../../common/text/normalizers";
import { toMoney } from "../domain/money";
import { getPayableStatus } from "../domain/payable-status.policy";
import { FinanceCodeService } from "./finance-code.service";

@Injectable()
export class PayableSyncService {
  constructor(private readonly financeCodes: FinanceCodeService) {}

  async createSupplierInvoicePayable(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      supplierId: string;
      supplierInvoiceId: string;
      totalAmount: Prisma.Decimal.Value;
      note?: string | null;
    },
  ) {
    const existing = await tx.financePayable.findFirst({
      where: {
        businessId: params.businessId,
        sourceType: FinanceSourceType.SUPPLIER_INVOICE,
        sourceId: params.supplierInvoiceId,
        status: {
          not: FinancePayableStatus.CANCELLED,
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException("Supplier invoice payable already exists");
    }

    return tx.financePayable.create({
      data: {
        businessId: params.businessId,
        payableNo: await this.financeCodes.generateUniquePayableNo(
          params.businessId,
        ),
        partyType: FinancePartyType.SUPPLIER,
        partyId: params.supplierId,
        sourceType: FinanceSourceType.SUPPLIER_INVOICE,
        sourceId: params.supplierInvoiceId,
        totalAmount: params.totalAmount,
        paidAmount: 0,
        status: FinancePayableStatus.PENDING,
        note: normalizeOptionalText(params.note),
      },
    });
  }

  async syncSupplierInvoicePayablePayment(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      supplierInvoiceId: string;
      paidAmount: Prisma.Decimal.Value;
    },
  ) {
    const payable = await tx.financePayable.findFirst({
      where: {
        businessId: params.businessId,
        sourceType: FinanceSourceType.SUPPLIER_INVOICE,
        sourceId: params.supplierInvoiceId,
        status: {
          not: FinancePayableStatus.CANCELLED,
        },
      },
    });

    if (!payable) {
      throw new NotFoundException("Supplier invoice payable not found");
    }

    const paidAmount = toMoney(params.paidAmount);
    const status = getPayableStatus(payable.totalAmount, paidAmount);

    return tx.financePayable.update({
      where: { id: payable.id },
      data: {
        paidAmount,
        status,
      },
    });
  }
}
