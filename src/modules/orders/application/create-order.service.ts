import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CatalogProductStatus,
  InvoiceStatus,
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderSource,
  OrderStatus,
  OrderType,
  Prisma,
  ProductVariantStatus,
} from "@prisma/client";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { CreatePosSaleDto } from "../../pos/dto/pos-sale.dto";
import { CreateOrderDto, OrderItemInputDto } from "../dto/order.dto";
import { assertOrderItems } from "../domain/order-item.policy";
import { assertOrderPaymentInput } from "../domain/order-payment.policy";
import { calculateOrderTotals } from "../domain/order-totals.calculator";
import type { OrderItemWithPrice } from "../domain/order.types";
import { OrderCodeRepository } from "../infrastructure/order-code.repository";
import { PrismaService } from "../../../prisma/prisma.service";
import { FinanceLedgerService } from "../../finance/common/finance-ledger.service";
import { InventoryLookupService } from "../../inventory/common/inventory-lookup.service";
import { OrderPaymentService } from "./order-payment.service";
import { apiResponse } from "../../../common/utils/api-response.util";

@Injectable()
export class CreateOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryLookupService,
    private readonly finance: FinanceLedgerService,
    private readonly codes: OrderCodeRepository,
    private readonly payments: OrderPaymentService,
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

  private async createOrderFlow(
    currentUser: CurrentUserPayload,
    businessId: string,
    params: CreateOrderDto & {
      orderType: OrderType;
      orderSource: OrderSource;
      fulfillImmediately: boolean;
    },
  ) {
    assertOrderItems(params.items);
    assertOrderPaymentInput(params.payment, params.isCod);

    if (params.isCod && !params.courier) {
      throw new BadRequestException("COD order requires courier shipment");
    }

    if (params.customerId) {
      await this.assertCustomerExists(businessId, params.customerId);
    }

    const [orderNo, invoiceNo, tax] = await Promise.all([
      this.codes.generateUniqueOrderNo(businessId),
      this.codes.generateUniqueInvoiceNo(businessId),
      this.finance.assertActiveTax(this.prisma, businessId, params.taxId),
    ]);
    const items = await this.buildItems(businessId, params.items, tax.rate);
    const totals = calculateOrderTotals(items, params.shippingCharge ?? 0);

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
            variantId: item.variantId ?? null,
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
          variantId: item.variantId ?? null,
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
        await this.payments.createPayment(tx, {
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

      return this.payments.refreshOrderPaymentState(
        tx,
        businessId,
        createdOrder.id,
      );
    });

    return apiResponse(order, "Order created successfully");
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
        variantId: string | null;
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
        variantId: string | null;
        quantity: Prisma.Decimal;
      }[];
      courier: NonNullable<CreateOrderDto["courier"]>;
      isCod: boolean;
      currentUserId: string;
    },
  ) {
    const shipmentNo = await this.codes.generateUniqueShipmentNo(
      params.businessId,
    );
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
      const product = await this.prisma.product.findFirst({
        where: {
          id: item.productId,
          businessId,
          deletedAt: null,
          status: CatalogProductStatus.ACTIVE,
        },
        select: {
          id: true,
          price: true,
          _count: {
            select: {
              variants: {
                where: { deletedAt: null },
              },
            },
          },
        },
      });

      if (!product) {
        throw new BadRequestException("One or more order items are invalid");
      }

      const selectedVariant = item.variantId
        ? await this.prisma.productVariant.findFirst({
            where: {
              id: item.variantId,
              productId: item.productId,
              businessId,
              deletedAt: null,
              status: ProductVariantStatus.ACTIVE,
            },
            select: { id: true, priceOverride: true },
          })
        : null;

      if (item.variantId && !selectedVariant) {
        throw new BadRequestException("One or more order items are invalid");
      }

      if (!item.variantId && product._count.variants > 0) {
        throw new BadRequestException(
          "Variant must be selected for a product that has variants",
        );
      }

      const quantity = new Prisma.Decimal(item.quantity);
      const discountAmount = new Prisma.Decimal(item.discountAmount ?? 0);
      const unitPrice = selectedVariant?.priceOverride ?? product.price;
      const lineSubtotal = quantity.mul(unitPrice);
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
        variantId: item.variantId ?? null,
        unitPrice,
        taxAmount,
        lineTotal,
      });
    }

    return builtItems;
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

  private normalizeNullableText(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }

    const normalizedValue = value?.trim();

    return normalizedValue || null;
  }
}
