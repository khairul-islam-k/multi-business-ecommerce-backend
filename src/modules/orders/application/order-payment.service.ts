import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  FinanceSourceType,
  InvoiceStatus,
  OrderPaymentStatus,
  courierShipment,
  invoice,
  orderOrder,
  orderPayment,
} from "@/database/schema";
import Decimal from "decimal.js";
import { and, eq, gt, isNull, sql } from "drizzle-orm";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import type {
  AddOrderPaymentDto,
  OrderPaymentInputDto,
} from "../dto/order.dto";
import {
  assertDirectOrderPayment,
  assertOrderCanAcceptPayment,
  assertSettlementPayment,
  getOrderPaymentStatus,
} from "../domain/order-payment.policy";
import { OrderCodeRepository } from "../infrastructure/order-code.repository";
import { OrderRepository } from "../infrastructure/order.repository";
import {
  DatabaseService,
  type DatabaseTransaction,
} from "../../../database/database.service";
import { FinanceLedgerService } from "../../finance/common/finance-ledger.service";
import { apiResponse } from "../../../common/utils/api-response.util";

@Injectable()
export class OrderPaymentService {
  constructor(
    private readonly database: DatabaseService,
    private readonly orders: OrderRepository,
    private readonly codes: OrderCodeRepository,
    private readonly finance: FinanceLedgerService,
  ) {}

  private get db() {
    return this.database.db;
  }

  async addPayment(
    currentUser: CurrentUserPayload,
    businessId: string,
    orderId: string,
    dto: AddOrderPaymentDto,
  ) {
    const order = await this.orders.getByIdOrThrow(businessId, orderId);

    assertOrderCanAcceptPayment(order.status);
    assertDirectOrderPayment(dto);

    const updatedOrder = await this.db.transaction(async (tx) => {
      const dueAmount = new Decimal(order.totalAmount).minus(order.paidAmount);

      await this.createPayment(tx, {
        businessId,
        orderId,
        payment: dto,
        amount: dueAmount,
        currentUserId: currentUser.id,
      });

      return this.refreshOrderPaymentState(tx, businessId, orderId);
    });

    return apiResponse(updatedOrder, "Order payment added successfully");
  }

  async createPayment(
    tx: DatabaseTransaction,
    params: {
      businessId: string;
      orderId: string;
      payment: OrderPaymentInputDto;
      amount: Decimal.Value;
      currentUserId: string;
    },
  ) {
    assertSettlementPayment(params.payment);

    const paymentNo = await this.codes.generateUniquePaymentNo(
      params.businessId,
    );
    const amount = new Decimal(params.amount);

    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException("Order has no payable amount remaining");
    }

    await tx.insert(orderPayment).values({
      businessId: params.businessId,
      orderId: params.orderId,
      financeAccountId: params.payment.financeAccountId,
      paymentNo,
      amount,
      paymentMethod: params.payment.paymentMethod,
      paymentStatus: OrderPaymentStatus.PAID,
      transactionReference: paymentNo,
      paidAt: new Date(),
      createdBy: params.currentUserId,
    });

    await this.finance.creditAccount(tx, {
      businessId: params.businessId,
      accountId: params.payment.financeAccountId,
      amount,
      referenceType: FinanceSourceType.ORDER,
      referenceId: params.orderId,
      createdBy: params.currentUserId,
    });
  }

  async refreshOrderPaymentState(
    tx: DatabaseTransaction,
    businessId: string,
    orderId: string,
  ) {
    const [order] = await tx
      .select()
      .from(orderOrder)
      .where(and(eq(orderOrder.id, orderId), eq(orderOrder.businessId, businessId)));

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    const payments = await tx
      .select()
      .from(orderPayment)
      .where(eq(orderPayment.orderId, order.id));
    const paidAmount = payments.reduce(
      (total, payment) => total.plus(payment.amount),
      new Decimal(0),
    );
    const paymentStatus = getOrderPaymentStatus(order.totalAmount, paidAmount);

    await tx
      .update(invoice)
      .set({
        paidAmount,
        status:
          paymentStatus === OrderPaymentStatus.PAID
            ? InvoiceStatus.PAID
            : paymentStatus === OrderPaymentStatus.PARTIALLY_PAID
              ? InvoiceStatus.PARTIALLY_PAID
              : InvoiceStatus.ISSUED,
      })
      .where(
        and(
          eq(invoice.businessId, businessId),
          eq(invoice.orderId, orderId),
          isNull(invoice.deletedAt),
        ),
      );

    const [codShipment] = await tx
      .select({ id: courierShipment.id })
      .from(courierShipment)
      .where(
        and(
          eq(courierShipment.businessId, businessId),
          eq(courierShipment.orderId, orderId),
          isNull(courierShipment.deletedAt),
          gt(courierShipment.codAmount, new Decimal(0)),
        ),
      );

    if (!codShipment) {
      await this.finance.syncOrderReceivable(tx, {
        businessId,
        orderId,
        customerId: order.customerId,
        totalAmount: order.totalAmount,
        receivedAmount: paidAmount,
      });
    }

    const [updatedOrder] = await tx
      .update(orderOrder)
      .set({
        paidAmount,
        paymentStatus,
      })
      .where(eq(orderOrder.id, orderId))
      .returning();

    return this.orders.hydrate(updatedOrder, tx);
  }
}
