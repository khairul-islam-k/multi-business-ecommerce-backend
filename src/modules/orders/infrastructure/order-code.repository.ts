import { BadRequestException, Injectable } from "@nestjs/common";
import {
  courierShipment,
  invoice,
  order,
  orderPayment,
} from "@/database/schema";
import { and, eq } from "drizzle-orm";

import { DatabaseService } from "../../../database/database.service";
import { generateRandomCode } from "../../../common/utils/code-generator.util";

const CODE_RETRY_LIMIT = 5;

@Injectable()
export class OrderCodeRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  generateUniqueOrderNo(businessId: string) {
    return this.generateUniqueCode(businessId, "ORD", async (code) => {
      const [row] = await this.db
        .select({ id: order.id })
        .from(order)
        .where(and(eq(order.businessId, businessId), eq(order.orderNo, code)));

      return row ?? null;
    });
  }

  generateUniquePaymentNo(businessId: string) {
    return this.generateUniqueCode(businessId, "PAY", async (code) => {
      const [row] = await this.db
        .select({ id: orderPayment.id })
        .from(orderPayment)
        .where(
          and(
            eq(orderPayment.businessId, businessId),
            eq(orderPayment.paymentNo, code),
          ),
        );

      return row ?? null;
    });
  }

  generateUniqueInvoiceNo(businessId: string) {
    return this.generateUniqueCode(businessId, "INV", async (code) => {
      const [row] = await this.db
        .select({ id: invoice.id })
        .from(invoice)
        .where(
          and(eq(invoice.businessId, businessId), eq(invoice.invoiceNo, code)),
        );

      return row ?? null;
    });
  }

  generateUniqueShipmentNo(businessId: string) {
    return this.generateUniqueCode(businessId, "SHP", async (code) => {
      const [row] = await this.db
        .select({ id: courierShipment.id })
        .from(courierShipment)
        .where(
          and(
            eq(courierShipment.businessId, businessId),
            eq(courierShipment.shipmentNo, code),
          ),
        );

      return row ?? null;
    });
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
