import Decimal from "decimal.js";
import { and, count, eq, isNull } from "drizzle-orm";

import {
  CatalogProductStatus,
  businessSetting,
  courierShipment,
  courierShipmentItem,
  customer,
  invoice,
  invoiceItem,
  InvoiceStatus,
  JsonValue,
  Order,
  order,
  OrderItem,
  orderItem,
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderSource,
  OrderStatus,
  orderStatusLog,
  OrderType,
  product,
  productVariant,
  ProductVariantStatus,
  warehouse,
  WarehouseStatus,
} from "@/database/schema";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { apiResponse } from "../../../common/utils/api-response.util";
import {
  DatabaseService,
  DatabaseTransaction,
} from "../../../database/database.service";
import { FinanceLedgerService } from "../../finance/common/finance-ledger.service";
import { InventoryLookupService } from "../../inventory/common/inventory-lookup.service";
import { CreatePosSaleDto } from "../../pos/dto/pos-sale.dto";
import { resolveProductEffectivePrice } from "../../product-catalog/common/product-offer-price";
import { assertOrderItems } from "../domain/order-item.policy";
import { assertOrderPaymentInput } from "../domain/order-payment.policy";
import { calculateOrderTotals } from "../domain/order-totals.calculator";
import { CreateOrderDto, OrderItemInputDto } from "../dto/order.dto";
import { OrderCodeRepository } from "../infrastructure/order-code.repository";
import { OrderPaymentService } from "./order-payment.service";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import type { OrderItemWithPrice } from "../domain/order.types";
import { CourierService } from "@/modules/couriers/courier.service";
import { CommonStoreListResponse, CourierProviderService } from "@/modules/couriers/courier-provider.service";

type TypeStore = {
  store_id: number;
  store_name: string;
  store_address: string | null;
  area_name: string | null;
  area_id: number | null;
  phone: string | null;
  city_id: number | null;
  zone_id: number | null;
  is_active: boolean | null;
}

@Injectable()
export class CreateOrderService {
  constructor(
    private readonly database: DatabaseService,
    private readonly inventoryLookupService: InventoryLookupService,
    private readonly financeLedgerService: FinanceLedgerService,
    private readonly orderCodeRepository: OrderCodeRepository,
    private readonly orderPaymentService: OrderPaymentService,
    private readonly courierProvider: CourierService,
    private readonly courierApi: CourierProviderService,
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
      initialStatus: OrderStatus.CONFIRMED,
    });
  }

  async createStorefrontOrder(businessId: string, dto: CreateOrderDto) {
    const settings = await this.assertStorefrontPaymentSettings(
      businessId,
      dto,
    );

    const defaultWarehouseId =
      await this.resolveDefaultWarehouseIdOrThrow(businessId);

    return this.createOrderFlow(undefined, businessId, {
      ...dto,
      warehouseId: defaultWarehouseId,
      orderType: OrderType.ONLINE,
      orderSource: OrderSource.WEBSITE,
      fulfillImmediately: false,
      initialStatus: settings.autoConfirmOrder
        ? OrderStatus.CONFIRMED
        : OrderStatus.PLACED,
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
      customerEmail: dto.customerEmail,
      warehouseId: dto.warehouseId,
      customerId: dto.customerId,
      items: dto.items,
      payment: dto.payment,
      orderType: OrderType.POS,
      orderSource: OrderSource.POS,
      fulfillImmediately: true,
      initialStatus: OrderStatus.DELIVERED,
    });
  }

  private async createOrderFlow(
    currentUser: CurrentUserPayload | undefined,
    businessId: string,
    params: CreateOrderDto & {
      orderType: OrderType;
      orderSource: OrderSource;
      fulfillImmediately: boolean;
      initialStatus: OrderStatus;
    },
  ) {
    assertOrderItems(params.items);
    assertOrderPaymentInput(params.payment, params.isCod);
    await this.assertBusinessOrderSettings(businessId, params);

    if (params.customerId) {
      await this.assertCustomerExists(businessId, params.customerId);
    }

    const [orderNo, invoiceNo] = await Promise.all([
      this.orderCodeRepository.generateUniqueOrderNo(businessId),
      this.orderCodeRepository.generateUniqueInvoiceNo(businessId),
    ]);

    const warehouseId =
      params.warehouseId ??
      (await this.resolveDefaultWarehouseIdOrThrow(businessId));
    const items = await this.buildItems(businessId, params.items);
    const totals = calculateOrderTotals(items, params.shippingCharge ?? 0);
    const taxSnapshot = this.deriveTaxSnapshot(items, totals);

    const createdOrder = await this.db.transaction(async (tx) => {
      const [createdOrder] = await tx
        .insert(order)
        .values({
          businessId,
          customerId: params.customerId,
          warehouseId,
          taxId: taxSnapshot.taxId,
          orderNo,
          orderType: params.orderType,
          orderSource: params.orderSource,
          status: params.initialStatus,
          paymentStatus: OrderPaymentStatus.UNPAID,
          isCod: params.isCod ?? false,
          customerName: this.normalizeNullableText(params.customerName),
          customerPhone: this.normalizeNullableText(params.customerPhone),
          customerEmail: this.normalizeNullableText(params.customerEmail),
          shippingAddressSnapshot: params.shippingAddressSnapshot as
            | JsonValue
            | undefined,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          taxRate: taxSnapshot.taxRate,
          shippingCharge: totals.shippingCharge,
          totalAmount: totals.totalAmount,
          note: this.normalizeNullableText(params.note),
          createdBy: currentUser?.id,
          paidAmount: new Decimal(0),
        })
        .returning();

      await tx.insert(orderStatusLog).values({
        orderId: createdOrder.id,
        toStatus: params.initialStatus,
        changedBy: currentUser?.id,
      });

      const createdItems: OrderItem[] = [];

      for (const item of items) {
        const [createdItem] = await tx
          .insert(orderItem)
          .values({
            orderId: createdOrder.id,
            productId: item.productId,
            variantId: item.variantId ?? null,
            taxId: item.taxId,
            quantity: new Decimal(item.quantity),
            unitPrice: item.unitPrice,
            discountAmount: new Decimal(item.discountAmount ?? 0),
            taxAmount: item.taxAmount,
            taxRate: item.taxRate,
            lineTotal: item.lineTotal,
          })
          .returning();

        createdItems.push(createdItem);

        const allocation = await this.inventoryLookupService.reserveForOrder(
          tx,
          {
            businessId,
            orderId: createdOrder.id,
            orderItemId: createdItem.id,
            productId: item.productId,
            variantId: item.variantId ?? null,
            quantity: item.quantity,
            warehouseId,
            createdBy: currentUser?.id,
          },
        );

        if (params.fulfillImmediately) {
          await this.inventoryLookupService.fulfillOrderAllocation(
            tx,
            { businessId, allocationId: allocation.id },
            currentUser?.id,
          );
        }
      }

      await this.createInvoice(tx, {
        businessId,
        order: createdOrder,
        items: createdItems,
        invoiceNo,
        currentUserId: currentUser?.id,
      });

      if (params.payment) {
        if (!currentUser?.id) {
          throw new BadRequestException(
            "Payment cannot be created without a system user",
          );
        }

        await this.orderPaymentService.createPayment(tx, {
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
          currentUserId: currentUser?.id,
        });
      }

      return this.orderPaymentService.refreshOrderPaymentState(
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
      currentUserId?: string;
    },
  ) {
    const [createdInvoice] = await tx
      .insert(invoice)
      .values({
        businessId: params.businessId,
        orderId: params.order.id,
        customerId: params.order.customerId,
        taxId: params.order.taxId,
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
        taxRate: params.order.taxRate,
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
        taxId: item.taxId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount,
        taxAmount: item.taxAmount,
        taxRate: item.taxRate,
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
      currentUserId?: string;
    },
  ) {
    const shipmentNo = await this.orderCodeRepository.generateUniqueShipmentNo(
      params.businessId,
    );
    const codAmount = params.isCod
      ? new Decimal(params.order.totalAmount).minus(params.order.paidAmount)
      : new Decimal(0);
    const [pickupWarehouse] = await tx
      .select()
      .from(warehouse)
      .where(
        and(
          eq(
            warehouse.id,
            params.courier.pickupWarehouseId ?? params.order.warehouseId,
          ),
          eq(warehouse.businessId, params.businessId),
          eq(warehouse.status, WarehouseStatus.ACTIVE),
          isNull(warehouse.deletedAt),
        ),
      )
      .limit(1);

    // console.log("wareHouse", pickupWarehouse, pickupWarehouse.redxStoreId);

    const { runtime } = await this.courierProvider.getActiveConfigRuntime(
      params.businessId,
      params.courier.courierConfigId,
    );

    const stores = await this.courierApi.listPickupStores(runtime);

    let store: TypeStore | undefined;
    let courierStoreId: string | null;

    switch (runtime.code) {
      case "REDX": {
        courierStoreId = pickupWarehouse.redxStoreId;
        store = stores?.stores.find(
          (data) =>
            Number(data.store_id) === Number(pickupWarehouse.redxStoreId),
        );
        break;
      }

      case "PATHAO": {
        courierStoreId = pickupWarehouse.pathaoStoreId;
        store = stores?.stores.find(
          (data) =>
            Number(data.store_id) === Number(pickupWarehouse.pathaoStoreId),
        );
        break;
      }
    }

    if (!store) {
      throw new BadRequestException("Please assign a courier  store");
    }

    const cities = await this.courierApi.getAreas(runtime);

    const city = cities?.data?.areas?.find(
      (data) => data.city_id === store.city_id,
    );

    const [shipment] = await tx
      .insert(courierShipment)
      .values({
        businessId: params.businessId,
        orderId: params.order.id,
        courierId: params.courier.courierId,
        courierConfigId: params.courier.courierConfigId,
        pickupWarehouseId:
          params.courier.pickupWarehouseId ?? params.order.warehouseId,
        shipmentNo,
        shippingCharge: params.order.shippingCharge,
        codAmount,
        deliveryCharge: new Decimal(params.courier.deliveryCharge ?? 0),
        codCharge: new Decimal(params.courier.codCharge ?? 0),
        courierFee: new Decimal(params.courier.courierFee ?? 0),
        recipientName:
          this.normalizeNullableText(params.courier.recipientName) ??
          params.order.customerName,
        recipientPhone:
          this.normalizeNullableText(params.courier.recipientPhone) ??
          params.order.customerPhone,
        deliveryAreaId: this.normalizeNullableText(
          params.courier.deliveryCityId,
        ),
        deliveryAreaName: this.normalizeNullableText(
          params.courier.deliveryAreaName,
        ),
        deliveryPostCode: this.normalizeNullableText(
          params.courier.deliveryPostCode,
        ),
        deliveryDivisionName: this.normalizeNullableText(
          params.courier.deliveryDivisionName,
        ),
        pickupAreaId: city?.city_id ?? 1,
        pickupAreaName: pickupWarehouse?.redxAreaName ?? city?.city_name,
        pickupPostCode: city?.post_code ?? 1212,
        pickupStoreId: courierStoreId,
        deliveryAddressSnapshot:
          (params.courier.deliveryAddressSnapshot as JsonValue | undefined) ??
          params.order.shippingAddressSnapshot ??
          undefined,
        providerRequest: {
          parcelWeight: params.courier.weight ?? 1,
          instruction:
            this.normalizeNullableText(params.courier.specialInstruction) ??
            null,
        } as JsonValue,
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

  private async buildItems(businessId: string, items: OrderItemInputDto[]) {
    const builtItems: OrderItemWithPrice[] = [];

    for (const item of items) {
      const [productRow] = await this.db
        .select({
          id: product.id,
          price: product.price,
          inOffer: product.inOffer,
          offerPrice: product.offerPrice,
          startingFrom: product.startingFrom,
          endsIn: product.endsIn,
          taxId: product.taxId,
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

      const tax = await this.financeLedgerService.assertActiveTax(
        this.db,
        businessId,
        productRow.taxId,
      );
      const rate = new Decimal(tax.rate);

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
      const productEffectivePrice = resolveProductEffectivePrice(productRow);
      const unitPrice =
        selectedVariant?.priceOverride ?? productEffectivePrice;
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
        taxId: tax.id,
        taxRate: rate,
        taxAmount,
        lineTotal,
      });
    }

    return builtItems;
  }

  private deriveTaxSnapshot(
    items: OrderItemWithPrice[],
    totals: ReturnType<typeof calculateOrderTotals>,
  ) {
    const uniqueTaxIds = new Set(items.map((item) => item.taxId));
    const taxableBase = totals.subtotal.minus(totals.discountTotal);
    const taxRate = taxableBase.equals(0)
      ? new Decimal(0)
      : totals.taxTotal.mul(100).div(taxableBase).toDecimalPlaces(2);

    return {
      taxId: uniqueTaxIds.size === 1 ? items[0]?.taxId : null,
      taxRate,
    };
  }

  private async assertCustomerExists(businessId: string, customerId: string) {
    const [existingCustomer] = await this.db
      .select({ id: customer.id })
      .from(customer)
      .where(
        and(
          eq(customer.id, customerId),
          eq(customer.businessId, businessId),
          isNull(customer.deletedAt),
        ),
      );

    if (!existingCustomer) {
      throw new NotFoundException(
        "Customer could not be found. It may not exist, may have been deleted, or may not belong to the current business or storefront.",
      );
    }
  }

  private async resolveDefaultWarehouseIdOrThrow(businessId: string) {
    const [settings] = await this.db
      .select({ defaultWarehouseId: businessSetting.defaultWarehouseId })
      .from(businessSetting)
      .where(eq(businessSetting.businessId, businessId))
      .limit(1);

    if (!settings?.defaultWarehouseId) {
      throw new BadRequestException(
        "Storefront orders require a default warehouse. Please set an active default warehouse in business settings before accepting storefront orders.",
      );
    }

    const [warehouseRow] = await this.db
      .select({ id: warehouse.id })
      .from(warehouse)
      .where(
        and(
          eq(warehouse.id, settings.defaultWarehouseId),
          eq(warehouse.businessId, businessId),
          eq(warehouse.status, WarehouseStatus.ACTIVE),
          isNull(warehouse.deletedAt),
        ),
      )
      .limit(1);

    if (!warehouseRow) {
      throw new BadRequestException(
        "Storefront orders require an active default warehouse. The configured default warehouse is missing, inactive, or deleted.",
      );
    }

    return warehouseRow.id;
  }

  private async assertStorefrontPaymentSettings(
    businessId: string,
    dto: CreateOrderDto,
  ) {
    const [settings] = await this.db
      .select({
        codEnabled: businessSetting.codEnabled,
        onlinePaymentEnabled: businessSetting.onlinePaymentEnabled,
        autoConfirmOrder: businessSetting.autoConfirmOrder,
      })
      .from(businessSetting)
      .where(eq(businessSetting.businessId, businessId))
      .limit(1);

    if (dto.isCod && !settings?.codEnabled) {
      throw new BadRequestException(
        "Cash on delivery is not enabled for this storefront",
      );
    }

    if (dto.payment && !settings?.onlinePaymentEnabled) {
      throw new BadRequestException(
        "Online payment is not enabled for this storefront",
      );
    }

    return {
      codEnabled: settings?.codEnabled ?? false,
      onlinePaymentEnabled: settings?.onlinePaymentEnabled ?? false,
      autoConfirmOrder: settings?.autoConfirmOrder ?? false,
    };
  }

  private async assertBusinessOrderSettings(
    businessId: string,
    dto: Pick<CreateOrderDto, "isCod">,
  ) {
    if (!dto.isCod) {
      return;
    }

    const [settings] = await this.db
      .select({ codEnabled: businessSetting.codEnabled })
      .from(businessSetting)
      .where(eq(businessSetting.businessId, businessId))
      .limit(1);

    if (!settings?.codEnabled) {
      throw new BadRequestException(
        "Cash on delivery is not enabled for this business",
      );
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
