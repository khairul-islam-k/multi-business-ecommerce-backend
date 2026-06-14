import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  FinanceSourceType,
  InvoiceStatus,
  OrderPaymentStatus,
  Prisma,
} from "@prisma/client";

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
import { ORDER_INCLUDE } from "../infrastructure/order.selects";
import { PrismaService } from "../../../prisma/prisma.service";
import { FinanceLedgerService } from "../../finance/common/finance-ledger.service";
import { apiResponse } from "../../../common/utils/api-response.util";

@Injectable()
export class OrderPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrderRepository,
    private readonly codes: OrderCodeRepository,
    private readonly finance: FinanceLedgerService,
  ) {}

  async addPayment(
    currentUser: CurrentUserPayload,
    businessId: string,
    orderId: string,
    dto: AddOrderPaymentDto,
  ) {
    const order = await this.orders.getByIdOrThrow(businessId, orderId);

    assertOrderCanAcceptPayment(order.status);
    assertDirectOrderPayment(dto);

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const dueAmount = new Prisma.Decimal(order.totalAmount).minus(
        order.paidAmount,
      );

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
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      orderId: string;
      payment: OrderPaymentInputDto;
      amount: Prisma.Decimal.Value;
      currentUserId: string;
    },
  ) {
    assertSettlementPayment(params.payment);

    const paymentNo = await this.codes.generateUniquePaymentNo(
      params.businessId,
    );
    const amount = new Prisma.Decimal(params.amount);

    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException("Order has no payable amount remaining");
    }

    await tx.orderPayment.create({
      data: {
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
      },
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
    tx: Prisma.TransactionClient,
    businessId: string,
    orderId: string,
  ) {
    const order = await tx.orderOrder.findFirst({
      where: { id: orderId, businessId },
      include: { payments: true },
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    const paidAmount = order.payments.reduce(
      (total, payment) => total.plus(payment.amount),
      new Prisma.Decimal(0),
    );
    const paymentStatus = getOrderPaymentStatus(order.totalAmount, paidAmount);

    await tx.invoice.updateMany({
      where: { businessId, orderId, deletedAt: null },
      data: {
        paidAmount,
        status:
          paymentStatus === OrderPaymentStatus.PAID
            ? InvoiceStatus.PAID
            : paymentStatus === OrderPaymentStatus.PARTIALLY_PAID
              ? InvoiceStatus.PARTIALLY_PAID
              : InvoiceStatus.ISSUED,
      },
    });

    const codShipment = await tx.courierShipment.findFirst({
      where: {
        businessId,
        orderId,
        deletedAt: null,
        codAmount: {
          gt: 0,
        },
      },
      select: { id: true },
    });

    if (!codShipment) {
      await this.finance.syncOrderReceivable(tx, {
        businessId,
        orderId,
        customerId: order.customerId,
        totalAmount: order.totalAmount,
        receivedAmount: paidAmount,
      });
    }

    return tx.orderOrder.update({
      where: { id: orderId },
      data: {
        paidAmount,
        paymentStatus,
      },
      include: ORDER_INCLUDE,
    });
  }
}
