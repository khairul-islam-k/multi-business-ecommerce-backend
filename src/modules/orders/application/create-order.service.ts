import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  type JsonValue,
  type Order,
  type OrderItem,
  CatalogProductStatus,
  InvoiceStatus,
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderSource,
  OrderStatus,
  OrderType,
  ProductVariantStatus,
  courierShipment,
  courierShipmentItem,
  invoice,
  invoiceItem,
  orderCustomer,
  order,
  orderItem,
  orderStatusLog,
  product,
  productVariant,
} from "@/database/schema";
import Decimal from "decimal.js";
import { and, count, eq, isNull } from "drizzle-orm";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { CreatePosSaleDto } from "../../pos/dto/pos-sale.dto";
import { CreateOrderDto, OrderItemInputDto } from "../dto/order.dto";
import { assertOrderItems } from "../domain/order-item.policy";
import { assertOrderPaymentInput } from "../domain/order-payment.policy";
import { calculateOrderTotals } from "../domain/order-totals.calculator";
import type { OrderItemWithPrice } from "../domain/order.types";
import { OrderCodeRepository } from "../infrastructure/order-code.repository";
import {
  DatabaseService,
  type DatabaseTransaction,
} from "../../../database/database.service";
import { FinanceLedgerService } from "../../finance/common/finance-ledger.service";
import { InventoryLookupService } from "../../inventory/common/inventory-lookup.service";
import { OrderPaymentService } from "./order-payment.service";
import { apiResponse } from "../../../common/utils/api-response.util";

@Injectable()
export class CreateOrderService {
  constructor(
    private readonly database: DatabaseService,
    private readonly inventory: InventoryLookupService,
    private readonly finance: FinanceLedgerService,
    private readonly codes: OrderCodeRepository,
    private readonly payments: OrderPaymentService,
  ) {}

  private get db() {
    return this.database.db;
  }

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
      customerId: dto.customerId,
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
      this.finance.assertActiveTax(this.db, businessId, params.taxId),
    ]);
    const items = await this.buildItems(businessId, params.items, tax.rate);
    const totals = calculateOrderTotals(items, params.shippingCharge ?? 0);

    const createdOrder = await this.db.transaction(async (tx) => {
      const [createdOrder] = await tx
        .insert(order)
        .values({
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
            | JsonValue
            | undefined,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          taxRate: tax.rate,
          shippingCharge: totals.shippingCharge,
          totalAmount: totals.totalAmount,
          note: this.normalizeNullableText(params.note),
          createdBy: currentUser.id,
          paidAmount: new Decimal(0),
        })
        .returning();

      await tx.insert(orderStatusLog).values({
        orderId: createdOrder.id,
        toStatus: params.fulfillImmediately
          ? OrderStatus.DELIVERED
          : OrderStatus.CONFIRMED,
        changedBy: currentUser.id,
      });

      const createdItems: OrderItem[] = [];

      for (const item of items) {
        const [createdItem] = await tx
          .insert(orderItem)
          .values({
            orderId: createdOrder.id,
            productId: item.productId,
            variantId: item.variantId ?? null,
            quantity: new Decimal(item.quantity),
            unitPrice: item.unitPrice,
            discountAmount: new Decimal(item.discountAmount ?? 0),
            taxAmount: item.taxAmount,
            lineTotal: item.lineTotal,
          })
          .returning();

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

    return apiResponse(createdOrder, "Order created successfully");
  }

  private async createInvoice(
    tx: DatabaseTransaction,
    params: {
      businessId: string;
      order: Order;
      items: OrderItem[];
      invoiceNo: string;
      taxId: string;
      taxRate: Decimal.Value;
      currentUserId: string;
    },
  ) {
    const [createdInvoice] = await tx
      .insert(invoice)
      .values({
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
        billingAddressSnapshot:
          params.order.shippingAddressSnapshot ?? undefined,
        subtotal: params.order.subtotal,
        discountTotal: params.order.discountTotal,
        taxTotal: params.order.taxTotal,
        taxRate: new Decimal(params.taxRate),
        shippingCharge: params.order.shippingCharge,
        totalAmount: params.order.totalAmount,
        paidAmount: params.order.paidAmount,
        note: params.order.note,
        createdBy: params.currentUserId,
      })
      .returning();

    await tx.insert(invoiceItem).values(
      params.items.map((item) => ({
        invoiceId: createdInvoice.id,
        orderItemId: item.id,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount,
        taxAmount: item.taxAmount,
        lineTotal: item.lineTotal,
      })),
    );
  }

  private async createCourierShipment(
    tx: DatabaseTransaction,
    params: {
      businessId: string;
      order: Order;
      items: OrderItem[];
      courier: NonNullable<CreateOrderDto["courier"]>;
      isCod: boolean;
      currentUserId: string;
    },
  ) {
    const shipmentNo = await this.codes.generateUniqueShipmentNo(
      params.businessId,
    );
    const codAmount = params.isCod
      ? new Decimal(params.order.totalAmount).minus(params.order.paidAmount)
      : new Decimal(0);

    const [shipment] = await tx
      .insert(courierShipment)
      .values({
        businessId: params.businessId,
        orderId: params.order.id,
        courierId: params.courier.courierId,
        deliveryZoneId: params.courier.deliveryZoneId,
        shipmentNo,
        shippingCharge: params.order.shippingCharge,
        codAmount,
        courierFee: new Decimal(params.courier.courierFee ?? 0),
        recipientName:
          this.normalizeNullableText(params.courier.recipientName) ??
          params.order.customerName,
        recipientPhone:
          this.normalizeNullableText(params.courier.recipientPhone) ??
          params.order.customerPhone,
        deliveryAddressSnapshot:
          (params.courier.deliveryAddressSnapshot as JsonValue | undefined) ??
          params.order.shippingAddressSnapshot ??
          undefined,
        createdBy: params.currentUserId,
      })
      .returning();

    await tx.insert(courierShipmentItem).values(
      params.items.map((item) => ({
        shipmentId: shipment.id,
        orderItemId: item.id,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      })),
    );
  }

  private async buildItems(
    businessId: string,
    items: OrderItemInputDto[],
    taxRate: Decimal.Value,
  ) {
    const builtItems: OrderItemWithPrice[] = [];
    const rate = new Decimal(taxRate);

    for (const item of items) {
      const [productRow] = await this.db
        .select({
          id: product.id,
          price: product.price,
        })
        .from(product)
        .where(
          and(
            eq(product.id, item.productId),
            eq(product.businessId, businessId),
            isNull(product.deletedAt),
            eq(product.status, CatalogProductStatus.ACTIVE),
          ),
        );

      if (!productRow) {
        throw new BadRequestException("One or more order items are invalid");
      }

      const [{ value: variantCount }] = await this.db
        .select({ value: count() })
        .from(productVariant)
        .where(
          and(
            eq(productVariant.businessId, businessId),
            eq(productVariant.productId, item.productId),
            isNull(productVariant.deletedAt),
          ),
        );

      const selectedVariant = item.variantId
        ? await this.db
            .select({
              id: productVariant.id,
              priceOverride: productVariant.priceOverride,
            })
            .from(productVariant)
            .where(
              and(
                eq(productVariant.id, item.variantId),
                eq(productVariant.productId, item.productId),
                eq(productVariant.businessId, businessId),
                isNull(productVariant.deletedAt),
                eq(productVariant.status, ProductVariantStatus.ACTIVE),
              ),
            )
            .then(([row]) => row ?? null)
        : null;

      if (item.variantId && !selectedVariant) {
        throw new BadRequestException("One or more order items are invalid");
      }

      if (!item.variantId && variantCount > 0) {
        throw new BadRequestException(
          "Variant must be selected for a product that has variants",
        );
      }

      const quantity = new Decimal(item.quantity);
      const discountAmount = new Decimal(item.discountAmount ?? 0);
      const unitPrice = selectedVariant?.priceOverride ?? productRow.price;
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
    const [customer] = await this.db
      .select({ id: orderCustomer.id })
      .from(orderCustomer)
      .where(
        and(
          eq(orderCustomer.id, customerId),
          eq(orderCustomer.businessId, businessId),
          isNull(orderCustomer.deletedAt),
        ),
      );

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
