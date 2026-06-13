import { BadRequestException, Injectable } from "@nestjs/common";

import { generateRandomCode } from "../../../common/utils/code-generator.util";
import { PrismaService } from "../../../prisma/prisma.service";

const CODE_RETRY_LIMIT = 5;

@Injectable()
export class OrderCodeRepository {
  constructor(private readonly prisma: PrismaService) {}

  generateUniqueOrderNo(businessId: string) {
    return this.generateUniqueCode(businessId, "ORD", (code) =>
      this.prisma.orderOrder.findFirst({
        where: { businessId, orderNo: code },
        select: { id: true },
      }),
    );
  }

  generateUniquePaymentNo(businessId: string) {
    return this.generateUniqueCode(businessId, "PAY", (code) =>
      this.prisma.orderPayment.findFirst({
        where: { businessId, paymentNo: code },
        select: { id: true },
      }),
    );
  }

  generateUniqueInvoiceNo(businessId: string) {
    return this.generateUniqueCode(businessId, "INV", (code) =>
      this.prisma.invoice.findFirst({
        where: { businessId, invoiceNo: code },
        select: { id: true },
      }),
    );
  }

  generateUniqueShipmentNo(businessId: string) {
    return this.generateUniqueCode(businessId, "SHP", (code) =>
      this.prisma.courierShipment.findFirst({
        where: { businessId, shipmentNo: code },
        select: { id: true },
      }),
    );
  }

  private async generateUniqueCode(
    businessId: string,
    prefix: string,
    finder: (code: string) => Promise<{ id: string } | null>,
  ) {
    for (let attempt = 0; attempt < CODE_RETRY_LIMIT; attempt++) {
      const code = generateRandomCode(prefix);
      const existing = await finder(code);

      if (!existing) {
        return code;
      }
    }

    throw new BadRequestException(
      `Could not generate ${prefix} number for business ${businessId}`,
    );
  }
}
