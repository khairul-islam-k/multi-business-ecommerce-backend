import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CourierShipmentStatus,
  FinanceReceivableStatus,
  FinanceSourceType,
  InvoiceStatus,
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderSource,
  OrderStatus,
  OrderType,
  Prisma,
  ProductVariantStatus,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../common/utils/api-response.util";
import { generateRandomCode } from "../../common/utils/code-generator.util";
import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { InventoryLookupService } from "../inventory/common/inventory-lookup.service";
import { FinanceLedgerService } from "../finance/common/finance-ledger.service";
import {
  AddOrderPaymentDto,
  CreateOrderDto,
  OrderItemInputDto,
  OrderPaymentInputDto,
  QueryOrderDto,
} from "./dto/order.dto";
import { CreatePosSaleDto } from "../pos/dto/pos-sale.dto";

const ORDER_INCLUDE = {
  customer: true,
  items: true,
  payments: true,
  statusLogs: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.OrderOrderInclude;

const CODE_RETRY_LIMIT = 5;

type OrderItemWithPrice = OrderItemInputDto & {
  unitPrice: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
};

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryLookupService,
    private readonly finance: FinanceLedgerService,
  ) {}

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreateOrderDto,
  ) {
    return this.createOrderFlow(currentUser, businessId, {
      ...dto,
      orderType: dto.orderType ?? OrderType.ADMIN,
      orderSource: dto.orderSource ?? OrderSource.ADMIN_PANEL,
      fulfillImmediately: false,
    });
  }

  async createPosSale(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreatePosSaleDto,
  ) {
    if (dto.payment.paymentMethod === OrderPaymentMethod.COD) {
      throw new BadRequestException("POS sale cannot use COD payment");
    }

    return this.createOrderFlow(currentUser, businessId, {
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      warehouseId: dto.warehouseId,
      taxId: dto.taxId,
      items: dto.items,
      payment: dto.payment,
      orderType: OrderType.POS,
      orderSource: OrderSource.POS,
      fulfillImmediately: true,
    });
  }

  async findAll(businessId: string, query: QueryOrderDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderOrderWhereInput = {
      businessId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
      ...(query.orderType ? { orderType: query.orderType } : {}),
      ...(query.search
        ? {
            OR: [
              { orderNo: { contains: query.search, mode: "insensitive" } },
              {
                customerName: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
              {
                customerPhone: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.orderOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: ORDER_INCLUDE,
      }),
      this.prisma.orderOrder.count({ where }),
    ]);

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findOne(businessId: string, orderId: string) {
    const order = await this.prisma.orderOrder.findFirst({
      where: { id: orderId, businessId, deletedAt: null },
      include: ORDER_INCLUDE,
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return apiResponse(order);
  }

  async addPayment(
    currentUser: CurrentUserPayload,
    businessId: string,
    orderId: string,
    dto: AddOrderPaymentDto,
  ) {
    const order = await this.getOrderOrThrow(businessId, orderId);

    const paymentBlockedStatuses: OrderStatus[] = [
      OrderStatus.CANCELLED,
      OrderStatus.RETURNED,
    ];

    if (paymentBlockedStatuses.includes(order.status)) {
      throw new BadRequestException("Payment cannot be added to this order");
    }

    if (dto.paymentMethod === OrderPaymentMethod.COD) {
      throw new BadRequestException(
        "COD is recorded through courier settlement",
      );
    }

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

  async ship(
    currentUser: CurrentUserPayload,
    businessId: string,
    orderId: string,
  ) {
    const order = await this.getOrderOrThrow(businessId, orderId);

    const shippableStatuses: OrderStatus[] = [
      OrderStatus.CONFIRMED,
      OrderStatus.PROCESSING,
    ];

    if (!shippableStatuses.includes(order.status)) {
      throw new BadRequestException("Order cannot be shipped");
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await tx.orderOrder.update({
        where: { id: orderId },
        data: { status: OrderStatus.SHIPPED },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: OrderStatus.SHIPPED,
          changedBy: currentUser.id,
        },
      });

      await tx.courierShipment.updateMany({
        where: {
          businessId,
          orderId,
          deletedAt: null,
          status: CourierShipmentStatus.PENDING,
        },
        data: {
          status: CourierShipmentStatus.BOOKED,
          shippedAt: new Date(),
        },
      });

      return tx.orderOrder.findFirst({
        where: { id: orderId, businessId },
        include: ORDER_INCLUDE,
      });
    });

    return apiResponse(updatedOrder, "Order shipped successfully");
  }

  async deliver(
    currentUser: CurrentUserPayload,
    businessId: string,
    orderId: string,
  ) {
    const order = await this.getOrderOrThrow(businessId, orderId);

    const deliverableStatuses: OrderStatus[] = [
      OrderStatus.CONFIRMED,
      OrderStatus.PROCESSING,
      OrderStatus.SHIPPED,
    ];

    if (!deliverableStatuses.includes(order.status)) {
      throw new BadRequestException("Order cannot be delivered");
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const allocations = await tx.inventoryOrderAllocation.findMany({
        where: { businessId, orderId, status: "RESERVED" },
        select: { id: true },
      });

      for (const allocation of allocations) {
        await this.inventory.fulfillOrderAllocation(
          tx,
          { businessId, allocationId: allocation.id },
          currentUser.id,
        );
      }

      await tx.orderOrder.update({
        where: { id: orderId },
        data: { status: OrderStatus.DELIVERED },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: OrderStatus.DELIVERED,
          changedBy: currentUser.id,
        },
      });

      const shipment = await tx.courierShipment.findFirst({
        where: { businessId, orderId, deletedAt: null },
      });

      if (shipment) {
        await tx.courierShipment.update({
          where: { id: shipment.id },
          data: {
            status: CourierShipmentStatus.DELIVERED,
            deliveredAt: new Date(),
          },
        });

        if (new Prisma.Decimal(shipment.codAmount).greaterThan(0)) {
          const existingReceivable = await tx.courierReceivable.findUnique({
            where: { shipmentId: shipment.id },
            select: { id: true },
          });

          if (!existingReceivable && shipment.courierId) {
            await tx.courierReceivable.create({
              data: {
                businessId,
                courierId: shipment.courierId,
                shipmentId: shipment.id,
                orderId,
                codAmount: shipment.codAmount,
                courierFee: shipment.courierFee,
                netReceivable: new Prisma.Decimal(shipment.codAmount).minus(
                  shipment.courierFee,
                ),
              },
            });
          }
        }
      }

      return tx.orderOrder.findFirst({
        where: { id: orderId, businessId },
        include: ORDER_INCLUDE,
      });
    });

    return apiResponse(updatedOrder, "Order delivered successfully");
  }

  async cancel(
    currentUser: CurrentUserPayload,
    businessId: string,
    orderId: string,
  ) {
    const order = await this.getOrderOrThrow(businessId, orderId);

    const cancelBlockedStatuses: OrderStatus[] = [
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
    ];

    if (cancelBlockedStatuses.includes(order.status)) {
      throw new BadRequestException("Order cannot be cancelled");
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const allocations = await tx.inventoryOrderAllocation.findMany({
        where: { businessId, orderId, status: "RESERVED" },
        select: { id: true },
      });

      for (const allocation of allocations) {
        await this.inventory.releaseOrderReservation(
          tx,
          { businessId, allocationId: allocation.id },
          currentUser.id,
        );
      }

      await tx.orderOrder.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
      });

      await tx.invoice.updateMany({
        where: { businessId, orderId, deletedAt: null },
        data: { status: InvoiceStatus.CANCELLED },
      });

      await tx.courierShipment.updateMany({
        where: { businessId, orderId, deletedAt: null },
        data: {
          status: CourierShipmentStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });

      await tx.financeReceivable.updateMany({
        where: {
          businessId,
          sourceType: FinanceSourceType.ORDER,
          sourceId: orderId,
        },
        data: {
          status: FinanceReceivableStatus.CANCELLED,
        },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: OrderStatus.CANCELLED,
          changedBy: currentUser.id,
        },
      });

      return tx.orderOrder.findFirst({
        where: { id: orderId, businessId },
        include: ORDER_INCLUDE,
      });
    });

    return apiResponse(updatedOrder, "Order cancelled successfully");
  }

  private async createOrderFlow(
    currentUser: CurrentUserPayload,
    businessId: string,
    params: CreateOrderDto & {
      orderType: OrderType;
      orderSource: OrderSource;
      fulfillImmediately: boolean;
    },
  ) {
    this.assertItems(params.items);
    this.assertPaymentInput(params.payment, params.isCod);

    if (params.isCod && !params.courier) {
      throw new BadRequestException("COD order requires courier shipment");
    }

    if (params.customerId) {
      await this.assertCustomerExists(businessId, params.customerId);
    }

    const [orderNo, invoiceNo, tax] = await Promise.all([
      this.generateUniqueOrderNo(businessId),
      this.generateUniqueInvoiceNo(businessId),
      this.finance.assertActiveTax(this.prisma, businessId, params.taxId),
    ]);
    const items = await this.buildItems(businessId, params.items, tax.rate);
    const totals = this.calculateTotals(items, params.shippingCharge ?? 0);

    const order = await this.prisma.$transaction(async (tx) => {
      const createdOrder = await tx.orderOrder.create({
        data: {
          businessId,
          customerId: params.customerId,
          warehouseId: params.warehouseId,
          taxId: tax.id,
          orderNo,
          orderType: params.orderType,
          orderSource: params.orderSource,
          status: params.fulfillImmediately
            ? OrderStatus.DELIVERED
            : OrderStatus.CONFIRMED,
          paymentStatus: OrderPaymentStatus.UNPAID,
          customerName: this.normalizeNullableText(params.customerName),
          customerPhone: this.normalizeNullableText(params.customerPhone),
          customerEmail: this.normalizeNullableText(params.customerEmail),
          shippingAddressSnapshot: params.shippingAddressSnapshot as
            | Prisma.InputJsonValue
            | undefined,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          taxRate: tax.rate,
          shippingCharge: totals.shippingCharge,
          totalAmount: totals.totalAmount,
          note: this.normalizeNullableText(params.note),
          createdBy: currentUser.id,
          statusLogs: {
            create: {
              toStatus: params.fulfillImmediately
                ? OrderStatus.DELIVERED
                : OrderStatus.CONFIRMED,
              changedBy: currentUser.id,
            },
          },
        },
      });

      const createdItems: Prisma.OrderOrderItemGetPayload<object>[] = [];

      for (const item of items) {
        const createdItem = await tx.orderOrderItem.create({
          data: {
            orderId: createdOrder.id,
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountAmount: item.discountAmount ?? 0,
            taxAmount: item.taxAmount,
            lineTotal: item.lineTotal,
          },
        });

        createdItems.push(createdItem);

        const allocation = await this.inventory.reserveForOrder(tx, {
          businessId,
          orderId: createdOrder.id,
          orderItemId: createdItem.id,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          warehouseId: params.warehouseId,
          createdBy: currentUser.id,
        });

        if (params.fulfillImmediately) {
          await this.inventory.fulfillOrderAllocation(
            tx,
            { businessId, allocationId: allocation.id },
            currentUser.id,
          );
        }
      }

      await this.createInvoice(tx, {
        businessId,
        order: createdOrder,
        items: createdItems,
        invoiceNo,
        taxId: tax.id,
        taxRate: tax.rate,
        currentUserId: currentUser.id,
      });

      if (params.payment) {
        await this.createPayment(tx, {
          businessId,
          orderId: createdOrder.id,
          payment: params.payment,
          amount: createdOrder.totalAmount,
          currentUserId: currentUser.id,
        });
      }

      if (params.courier) {
        await this.createCourierShipment(tx, {
          businessId,
          order: createdOrder,
          items: createdItems,
          courier: params.courier,
          isCod: params.isCod ?? false,
          currentUserId: currentUser.id,
        });
      }

      return this.refreshOrderPaymentState(tx, businessId, createdOrder.id);
    });

    return apiResponse(order, "Order created successfully");
  }

  private async createPayment(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      orderId: string;
      payment: OrderPaymentInputDto;
      amount: Prisma.Decimal.Value;
      currentUserId: string;
    },
  ) {
    if (params.payment.paymentMethod === OrderPaymentMethod.COD) {
      throw new BadRequestException(
        "COD payment is handled by courier settlement",
      );
    }

    if (!params.payment.financeAccountId) {
      throw new BadRequestException("Finance account is required for payment");
    }

    const paymentNo = await this.generateUniquePaymentNo(params.businessId);
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
        transactionReference: this.normalizeNullableText(
          params.payment.transactionReference,
        ),
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

  private async refreshOrderPaymentState(
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
    const totalAmount = new Prisma.Decimal(order.totalAmount);
    const paymentStatus = paidAmount.isZero()
      ? OrderPaymentStatus.UNPAID
      : paidAmount.lessThan(totalAmount)
        ? OrderPaymentStatus.PARTIALLY_PAID
        : OrderPaymentStatus.PAID;

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

  private async createInvoice(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      order: {
        id: string;
        customerId: string | null;
        customerName: string | null;
        customerPhone: string | null;
        customerEmail: string | null;
        shippingAddressSnapshot: Prisma.JsonValue | null;
        subtotal: Prisma.Decimal;
        discountTotal: Prisma.Decimal;
        taxTotal: Prisma.Decimal;
        shippingCharge: Prisma.Decimal;
        totalAmount: Prisma.Decimal;
        paidAmount: Prisma.Decimal;
        note: string | null;
      };
      items: {
        id: string;
        productId: string;
        variantId: string;
        quantity: Prisma.Decimal;
        unitPrice: Prisma.Decimal;
        discountAmount: Prisma.Decimal;
        taxAmount: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
      }[];
      invoiceNo: string;
      taxId: string;
      taxRate: Prisma.Decimal;
      currentUserId: string;
    },
  ) {
    await tx.invoice.create({
      data: {
        businessId: params.businessId,
        orderId: params.order.id,
        customerId: params.order.customerId,
        taxId: params.taxId,
        invoiceNo: params.invoiceNo,
        invoiceDate: new Date(),
        status: InvoiceStatus.ISSUED,
        customerName: params.order.customerName,
        customerPhone: params.order.customerPhone,
        customerEmail: params.order.customerEmail,
        billingAddressSnapshot: params.order.shippingAddressSnapshot as
          | Prisma.InputJsonValue
          | undefined,
        subtotal: params.order.subtotal,
        discountTotal: params.order.discountTotal,
        taxTotal: params.order.taxTotal,
        taxRate: params.taxRate,
        shippingCharge: params.order.shippingCharge,
        totalAmount: params.order.totalAmount,
        paidAmount: params.order.paidAmount,
        note: params.order.note,
        createdBy: params.currentUserId,
        items: {
          create: params.items.map((item) => ({
            orderItemId: item.id,
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountAmount: item.discountAmount,
            taxAmount: item.taxAmount,
            lineTotal: item.lineTotal,
          })),
        },
      },
    });
  }

  private async createCourierShipment(
    tx: Prisma.TransactionClient,
    params: {
      businessId: string;
      order: {
        id: string;
        totalAmount: Prisma.Decimal;
        paidAmount: Prisma.Decimal;
        shippingCharge: Prisma.Decimal;
        customerName: string | null;
        customerPhone: string | null;
        shippingAddressSnapshot: Prisma.JsonValue | null;
      };
      items: {
        id: string;
        productId: string;
        variantId: string;
        quantity: Prisma.Decimal;
      }[];
      courier: NonNullable<CreateOrderDto["courier"]>;
      isCod: boolean;
      currentUserId: string;
    },
  ) {
    const shipmentNo = await this.generateUniqueShipmentNo(params.businessId);
    const codAmount = params.isCod
      ? new Prisma.Decimal(params.order.totalAmount).minus(
          params.order.paidAmount,
        )
      : new Prisma.Decimal(0);

    await tx.courierShipment.create({
      data: {
        businessId: params.businessId,
        orderId: params.order.id,
        courierId: params.courier.courierId,
        deliveryZoneId: params.courier.deliveryZoneId,
        shipmentNo,
        shippingCharge: params.order.shippingCharge,
        codAmount,
        courierFee: params.courier.courierFee ?? 0,
        recipientName:
          this.normalizeNullableText(params.courier.recipientName) ??
          params.order.customerName,
        recipientPhone:
          this.normalizeNullableText(params.courier.recipientPhone) ??
          params.order.customerPhone,
        deliveryAddressSnapshot:
          (params.courier.deliveryAddressSnapshot as Prisma.InputJsonValue) ??
          (params.order.shippingAddressSnapshot as Prisma.InputJsonValue),
        createdBy: params.currentUserId,
        items: {
          create: params.items.map((item) => ({
            orderItemId: item.id,
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          })),
        },
      },
    });
  }

  private async buildItems(
    businessId: string,
    items: OrderItemInputDto[],
    taxRate: Prisma.Decimal.Value,
  ) {
    const builtItems: OrderItemWithPrice[] = [];
    const rate = new Prisma.Decimal(taxRate);

    for (const item of items) {
      const variant = await this.prisma.productVariant.findFirst({
        where: {
          id: item.variantId,
          productId: item.productId,
          businessId,
          deletedAt: null,
          status: ProductVariantStatus.ACTIVE,
        },
        select: { price: true },
      });

      if (!variant) {
        throw new BadRequestException("One or more order items are invalid");
      }

      const quantity = new Prisma.Decimal(item.quantity);
      const discountAmount = new Prisma.Decimal(item.discountAmount ?? 0);
      const lineSubtotal = quantity.mul(variant.price);
      const taxableAmount = lineSubtotal.minus(discountAmount);
      const taxAmount = taxableAmount.mul(rate).div(100).toDecimalPlaces(2);
      const lineTotal = taxableAmount.plus(taxAmount);

      if (lineTotal.lessThan(0)) {
        throw new BadRequestException(
          "Order item line total cannot be negative",
        );
      }

      builtItems.push({
        ...item,
        unitPrice: variant.price,
        taxAmount,
        lineTotal,
      });
    }

    return builtItems;
  }

  private calculateTotals(items: OrderItemWithPrice[], shippingCharge: number) {
    const subtotal = items.reduce(
      (total, item) =>
        total.plus(new Prisma.Decimal(item.quantity).mul(item.unitPrice)),
      new Prisma.Decimal(0),
    );
    const discountTotal = items.reduce(
      (total, item) => total.plus(item.discountAmount ?? 0),
      new Prisma.Decimal(0),
    );
    const taxTotal = items.reduce(
      (total, item) => total.plus(item.taxAmount),
      new Prisma.Decimal(0),
    );
    const shipping = new Prisma.Decimal(shippingCharge);

    return {
      subtotal,
      discountTotal,
      taxTotal,
      shippingCharge: shipping,
      totalAmount: subtotal.minus(discountTotal).plus(taxTotal).plus(shipping),
    };
  }

  private async getOrderOrThrow(businessId: string, orderId: string) {
    const order = await this.prisma.orderOrder.findFirst({
      where: { id: orderId, businessId, deletedAt: null },
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return order;
  }

  private async assertCustomerExists(businessId: string, customerId: string) {
    const customer = await this.prisma.orderCustomer.findFirst({
      where: { id: customerId, businessId, deletedAt: null },
      select: { id: true },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }
  }

  private assertItems(items: OrderItemInputDto[]) {
    if (items.length === 0) {
      throw new BadRequestException("At least one order item is required");
    }

    const variantIds = new Set(items.map((item) => item.variantId));

    if (variantIds.size !== items.length) {
      throw new BadRequestException("Order cannot contain duplicate variants");
    }
  }

  private assertPaymentInput(
    payment: OrderPaymentInputDto | undefined,
    isCod?: boolean,
  ) {
    if (isCod && payment) {
      throw new BadRequestException("COD order cannot include direct payment");
    }

    if (payment?.paymentMethod === OrderPaymentMethod.COD) {
      throw new BadRequestException("COD should not be recorded as a payment");
    }
  }

  private async generateUniqueOrderNo(businessId: string) {
    return this.generateUniqueCode(businessId, "ORD", (code) =>
      this.prisma.orderOrder.findFirst({
        where: { businessId, orderNo: code },
        select: { id: true },
      }),
    );
  }

  private async generateUniquePaymentNo(businessId: string) {
    return this.generateUniqueCode(businessId, "PAY", (code) =>
      this.prisma.orderPayment.findFirst({
        where: { businessId, paymentNo: code },
        select: { id: true },
      }),
    );
  }

  private async generateUniqueInvoiceNo(businessId: string) {
    return this.generateUniqueCode(businessId, "INV", (code) =>
      this.prisma.invoice.findFirst({
        where: { businessId, invoiceNo: code },
        select: { id: true },
      }),
    );
  }

  private async generateUniqueShipmentNo(businessId: string) {
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

  private normalizeNullableText(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }

    const normalizedValue = value?.trim();

    return normalizedValue || null;
  }
}
