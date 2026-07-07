import { createHash, randomBytes, timingSafeEqual } from "crypto";
import Decimal from "decimal.js";
import { and, count, desc, eq, ilike, isNull, ne, or } from "drizzle-orm";

import {
  businessSetting,
  CatalogProductStatus,
  courier,
  courierConfig,
  CourierConfigMode,
  CourierConfigStatus,
  CourierProvider,
  CourierShipment,
  courierShipment,
  courierShipmentItem,
  CourierShipmentStatus,
  CourierStatus,
  FinancePartyType,
  financeReceivable,
  FinanceReceivableStatus,
  FinanceSourceType,
  financeTax,
  FinanceTaxStatus,
  inventoryOrderAllocation,
  InventoryOrderAllocationStatus,
  invoice,
  InvoiceStatus,
  JsonValue,
  order,
  orderItem,
  OrderPaymentStatus,
  OrderStatus,
  orderStatusLog,
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

import { AppConfigService } from "../../common/config/app-config.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../common/utils/api-response.util";
import {
  normalizeSearch,
  normalizeSearchUuid,
} from "../../common/http/search.util";
import { DatabaseService } from "../../database/database.service";
import { FinanceCodeService } from "../finance/application/finance-code.service";
import { InventoryLookupService } from "../inventory/common/inventory-lookup.service";
import { OrderCodeRepository } from "../orders/infrastructure/order-code.repository";
import { WebsiteService } from "../website/website.service";
import { CourierConfigEncryptionService } from "./courier-config-encryption.service";
import {
  CourierProviderService,
  RedxWebhookPayload,
} from "./courier-provider.service";
import {
  AssignCourierToOrderDto,
  BulkUpdateCourierConfigDto,
  QueryCourierConfigDto,
  QueryCourierDto,
  RedxAreaQueryDto,
  RedxChargeQuoteDto,
  RedxCreatePickupStoreDto,
  // RedxUpdatePickupStoreDto,
  StorefrontCourierQuoteDto,
  StorefrontCourierSelectionDto,
  UpdateCourierConfigDto,
} from "./dto/courier.dto";

import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import type { DatabaseTransaction } from "../../database/database.service";

type CourierConfigRow = typeof courierConfig.$inferSelect & {
  courier: typeof courier.$inferSelect;
};

type RedxPickupWarehouse = typeof warehouse.$inferSelect & {
  redxAreaId: string;
  redxAreaName: string;
};

type CourierItemMetricInput = {
  productId: string;
  variantId?: string | null;
  quantity: Decimal.Value;
};

@Injectable()
export class CourierService {
  constructor(
    private readonly database: DatabaseService,
    private readonly configEncryption: CourierConfigEncryptionService,
    private readonly provider: CourierProviderService,
    private readonly websites: WebsiteService,
    private readonly appConfig: AppConfigService,
    private readonly orderCodes: OrderCodeRepository,
    private readonly inventory: InventoryLookupService,
    private readonly financeCodes: FinanceCodeService,
  ) {}

  private get db() {
    return this.database.db;
  }

  async findCouriers(query: QueryCourierDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const search = normalizeSearch(query.search);
    const searchUuid = normalizeSearchUuid(search);
    const where = and(
      query.provider ? eq(courier.code, query.provider) : undefined,
      query.status ? eq(courier.status, query.status) : undefined,
      search
        ? or(
            searchUuid ? eq(courier.id, searchUuid) : undefined,
            ilike(courier.name, `%${search}%`),
            ilike(courier.code, `%${search}%`),
          )
        : undefined,
    );

    const [items, total] = await Promise.all([
      this.db
        .select()
        .from(courier)
        .where(where)
        .orderBy(courier.name)
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(courier)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(
      items,
      { page, limit, total, totalPages: Math.ceil(total / limit) },
      "Couriers were loaded successfully.",
    );
  }

  async findConfigs(businessId: string, query: QueryCourierConfigDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const search = normalizeSearch(query.search);
    const searchUuid = normalizeSearchUuid(search);
    const where = and(
      eq(courierConfig.businessId, businessId),
      isNull(courierConfig.deletedAt),
      query.status ? eq(courierConfig.status, query.status) : undefined,
      search
        ? or(
            searchUuid ? eq(courierConfig.id, searchUuid) : undefined,
            searchUuid ? eq(courierConfig.courierId, searchUuid) : undefined,
            ilike(courier.name, `%${search}%`),
            ilike(courier.code, `%${search}%`),
          )
        : undefined,
    );

    const [rows, total] = await Promise.all([
      this.db
        .select({ config: courierConfig, courier })
        .from(courierConfig)
        .innerJoin(courier, eq(courier.id, courierConfig.courierId))
        .where(where)
        .orderBy(desc(courierConfig.createdAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(courierConfig)
        .innerJoin(courier, eq(courier.id, courierConfig.courierId))
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(
      rows.map(({ config, courier: courierRow }) =>
        this.serializeConfig({ ...config, courier: courierRow }),
      ),
      { page, limit, total, totalPages: Math.ceil(total / limit) },
      "Courier configurations were loaded successfully.",
    );
  }

  async updateConfig(
    currentUser: CurrentUserPayload,
    businessId: string,
    configId: string,
    dto: UpdateCourierConfigDto,
  ) {
    const row = await this.getConfigRowOrThrow(businessId, configId);
    const decrypted = this.configEncryption.decrypt(row.configData);
    const nextMode = dto.mode ?? row.mode;
    const nextConfigData = this.provider.sanitizeRedxConfigData({
      ...decrypted,
      ...(dto.configData ?? {}),
    });
    const nextStatus = dto.status ?? row.status;

    if (nextStatus === CourierConfigStatus.ACTIVE) {
      this.assertRedxConfigUsable(nextConfigData, nextMode);
    }

    const nextWebhookToken = dto.rotateWebhookToken
      ? this.generateWebhookToken()
      : null;

    const [updated] = await this.db
      .update(courierConfig)
      .set({
        ...((dto.configData !== undefined || "baseUrl" in decrypted) && {
          configData: this.configEncryption.encrypt(nextConfigData),
        }),
        ...(dto.mode !== undefined && { mode: dto.mode }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(nextWebhookToken && {
          webhookTokenHash: this.hashWebhookToken(nextWebhookToken),
        }),
        updatedBy: currentUser.id,
      })
      .where(eq(courierConfig.id, configId))
      .returning();

    const serialized = this.serializeConfig({
      ...updated,
      courier: row.courier,
    });

    return apiResponse(
      {
        ...serialized,
        ...(nextWebhookToken && {
          webhookToken: nextWebhookToken,
          webhookUrl: this.buildWebhookUrl(nextWebhookToken),
        }),
      },
      "Courier configuration updated successfully.",
    );
  }

  async bulkUpdateConfig(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: BulkUpdateCourierConfigDto,
  ) {
    const results: unknown[] = [];

    for (const item of dto.configs ?? []) {
      const configId = (item as { configId?: string }).configId;

      if (!configId) {
        throw new BadRequestException(
          "Each courier config update requires configId",
        );
      }

      results.push(
        (await this.updateConfig(currentUser, businessId, configId, item)).data,
      );
    }

    return apiResponse(results, "Courier configurations updated successfully.");
  }

  async getRedxAreas(
    businessId: string,
    configId: string,
    query: RedxAreaQueryDto,
  ) {
    const { runtime } = await this.getActiveRedxRuntime(businessId, configId);
    return apiResponse(await this.provider.getAreas(runtime, query));
  }

  async calculateRedxCharge(
    businessId: string,
    configId: string,
    dto: RedxChargeQuoteDto,
  ) {
    const quote = await this.calculateBusinessQuote(businessId, configId, dto);
    return apiResponse(quote);
  }

  async listRedxPickupStores(businessId: string, configId: string) {
    const { runtime } = await this.getActiveRedxRuntime(businessId, configId);
    return apiResponse(await this.provider.listPickupStores(runtime));
  }

  async createRedxPickupStore(
    businessId: string,
    configId: string,
    dto: RedxCreatePickupStoreDto,
  ) {
    const { runtime } = await this.getActiveRedxRuntime(businessId, configId);
    return apiResponse(
      await this.provider.createPickupStore(runtime, {
        name: dto.name.trim(),
        phone: dto.phone.trim(),
        address: dto.address.trim(),
        areaId: dto.areaId.trim(),
      }),
    );
  }

  async getRedxPickupStore(
    businessId: string,
    configId: string,
    storeId: string,
  ) {
    const { runtime } = await this.getActiveRedxRuntime(businessId, configId);
    return apiResponse(
      await this.provider.getPickupStoreDetails(runtime, storeId),
    );
  }

  // async updateRedxPickupStore(
  //   businessId: string,
  //   configId: string,
  //   storeId: string,
  //   dto: RedxUpdatePickupStoreDto,
  // ) {
  //   const name = dto.name?.trim();
  //   const phone = dto.phone?.trim();
  //   const address = dto.address?.trim();
  //   const areaId = dto.areaId?.trim();
  //   const payload = {
  //     ...(name && { name }),
  //     ...(phone && { phone }),
  //     ...(address && { address }),
  //     ...(areaId && { areaId }),
  //   };

  //   if (Object.keys(payload).length === 0) {
  //     throw new BadRequestException(
  //       "At least one pickup store field is required for update.",
  //     );
  //   }

  //   const { runtime } = await this.getActiveRedxRuntime(businessId, configId);
  //   return apiResponse(
  //     await this.provider.updatePickupStore(runtime, storeId, payload),
  //     "REDX pickup store updated successfully.",
  //   );
  // }

  // async deleteRedxPickupStore(
  //   businessId: string,
  //   configId: string,
  //   storeId: string,
  // ) {
  //   const { runtime } = await this.getActiveRedxRuntime(businessId, configId);
  //   return apiResponse(
  //     await this.provider.deletePickupStore(runtime, storeId),
  //     "REDX pickup store deleted successfully.",
  //   );
  // }

  async findStorefrontCouriers(host?: string) {
    const storefront = await this.websites.findPublishedByHostOrThrow(host);
    const rows = await this.db
      .select({ config: courierConfig, courier })
      .from(courierConfig)
      .innerJoin(courier, eq(courier.id, courierConfig.courierId))
      .where(
        and(
          eq(courierConfig.businessId, storefront.businessId),
          eq(courierConfig.status, CourierConfigStatus.ACTIVE),
          eq(courier.code, CourierProvider.REDX),
          eq(courier.status, CourierStatus.ACTIVE),
          isNull(courierConfig.deletedAt),
        ),
      )
      .orderBy(courier.name);

    return apiResponse(
      rows.map(({ config, courier: courierRow }) =>
        this.serializeConfig({ ...config, courier: courierRow }),
      ),
    );
  }

  async findStorefrontRedxAreas(
    host: string | undefined,
    configId: string,
    query: RedxAreaQueryDto,
  ) {
    const storefront = await this.websites.findPublishedByHostOrThrow(host);
    return this.getRedxAreas(storefront.businessId, configId, query);
  }

  async calculateStorefrontShippingCharge(
    host: string | undefined,
    configId: string,
    dto: StorefrontCourierQuoteDto,
  ) {
    const storefront = await this.websites.findPublishedByHostOrThrow(host);
    return this.calculateRedxCharge(storefront.businessId, configId, dto);
  }

  async prepareStorefrontOrderCourier(
    businessId: string,
    configId: string,
    dto: StorefrontCourierSelectionDto | undefined,
    isCod: boolean,
    items: CourierItemMetricInput[],
  ) {
    if (!dto) {
      throw new BadRequestException(
        "Courier quote is required when courier is selected",
      );
    }

    const quote = await this.calculateBusinessQuote(businessId, configId, dto, {
      items,
      collectCash: isCod,
    });

    return {
      shippingCharge: quote.shippingCharge,
      courier: {
        courierId: quote.courierId,
        courierConfigId: configId,
        pickupWarehouseId: quote.pickupWarehouse.id,
        deliveryAreaId: dto.deliveryAreaId,
        deliveryAreaName: dto.deliveryAreaName,
        deliveryPostCode: dto.deliveryPostCode,
        deliveryDivisionName: dto.deliveryDivisionName,
        weight: quote.weight,
        deliveryCharge: quote.deliveryCharge,
        codCharge: quote.codCharge,
        courierFee: quote.courierFee,
        specialInstruction: dto.specialInstruction,
      },
    };
  }

  async assignCourierToOrder(
    currentUser: CurrentUserPayload,
    businessId: string,
    orderId: string,
    dto: AssignCourierToOrderDto,
  ) {
    const quote = await this.calculateBusinessQuote(
      businessId,
      dto.courierConfigId,
      dto,
      { orderId },
    );
    const shipment = await this.createOrUpdateShipmentForOrder(
      businessId,
      orderId,
      {
        courierId: quote.courierId,
        courierConfigId: dto.courierConfigId,
        pickupWarehouseId: quote.pickupWarehouse.id,
        deliveryAreaId: dto.deliveryAreaId,
        deliveryAreaName: dto.deliveryAreaName,
        deliveryPostCode: dto.deliveryPostCode,
        deliveryDivisionName: dto.deliveryDivisionName,
        weight: quote.weight,
        deliveryCharge: quote.deliveryCharge,
        codCharge: quote.codCharge,
        courierFee: quote.courierFee,
        specialInstruction: dto.specialInstruction,
        createdBy: currentUser.id,
      },
    );
    const booked = await this.bookShipment(
      currentUser.id,
      businessId,
      shipment.id,
    );

    return apiResponse(
      booked,
      "Courier assigned and REDX parcel booked successfully.",
    );
  }

  async bookShipmentForOrder(businessId: string, orderId: string) {
    const [shipment] = await this.db
      .select()
      .from(courierShipment)
      .where(
        and(
          eq(courierShipment.businessId, businessId),
          eq(courierShipment.orderId, orderId),
          isNull(courierShipment.deletedAt),
        ),
      )
      .limit(1);

    if (!shipment || shipment.trackingCode) {
      return shipment;
    }

    return this.bookShipment(undefined, businessId, shipment.id);
  }

  async tryBookShipmentForOrder(businessId: string, orderId: string) {
    try {
      return {
        shipment: await this.bookShipmentForOrder(businessId, orderId),
        bookingError: null,
      };
    } catch (error) {
      return {
        shipment: null,
        bookingError: this.errorPayload(error),
      };
    }
  }

  async retryBookShipment(
    currentUser: CurrentUserPayload,
    businessId: string,
    shipmentId: string,
  ) {
    const booked = await this.bookShipment(
      currentUser.id,
      businessId,
      shipmentId,
    );

    return apiResponse(booked, "REDX parcel booking retried successfully.");
  }

  async trackShipment(businessId: string, shipmentId: string) {
    const shipment = await this.getShipmentOrThrow(businessId, shipmentId);

    if (!shipment.trackingCode) {
      throw new BadRequestException(
        "Shipment has not been booked with REDX yet. Retry booking before tracking it.",
      );
    }

    const { runtime } = await this.getActiveRedxRuntime(
      businessId,
      shipment.courierConfigId,
    );
    const providerTracking = await this.provider.trackParcel(
      runtime,
      shipment.trackingCode,
    );
    const providerStatus =
      this.provider.extractProviderStatus(providerTracking);
    const nextStatus = providerStatus
      ? this.provider.mapWebhookStatus(providerStatus)
      : shipment.status;
    const updatedShipment = await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(courierShipment)
        .set({
          providerStatus: providerStatus ?? shipment.providerStatus,
          status: nextStatus,
          providerResponse: providerTracking as JsonValue,
          ...(nextStatus === CourierShipmentStatus.DELIVERED && {
            deliveredAt: shipment.deliveredAt ?? new Date(),
          }),
          ...(nextStatus === CourierShipmentStatus.CANCELLED && {
            cancelledAt: shipment.cancelledAt ?? new Date(),
          }),
        })
        .where(eq(courierShipment.id, shipment.id))
        .returning();

      if (nextStatus === CourierShipmentStatus.DELIVERED) {
        await this.applyDeliveredEffects(tx, shipment, undefined);
      }

      if (nextStatus === CourierShipmentStatus.RETURNED) {
        await this.applyReturnedEffects(tx, shipment, undefined);
      }

      return updated;
    });

    return apiResponse({
      shipment: updatedShipment,
      providerTracking,
    });
  }

  async receiveRedxWebhook(token: string | undefined, dto: RedxWebhookPayload) {
    if (!token) {
      throw new BadRequestException("REDX webhook token is required");
    }

    const tokenHash = this.hashWebhookToken(token);
    const [config] = await this.db
      .select()
      .from(courierConfig)
      .where(
        and(
          eq(courierConfig.webhookTokenHash, tokenHash),
          isNull(courierConfig.deletedAt),
        ),
      )
      .limit(1);

    if (!config || !this.matchesWebhookToken(token, config.webhookTokenHash)) {
      throw new BadRequestException("Invalid REDX webhook token");
    }

    const trackingNumber = dto.tracking_number?.trim();
    const invoiceNumber = dto.invoice_number?.trim();
    const nextStatus = this.provider.mapWebhookStatus(dto.status);

    const [shipment] = await this.db
      .select()
      .from(courierShipment)
      .where(
        and(
          eq(courierShipment.businessId, config.businessId),
          isNull(courierShipment.deletedAt),
          trackingNumber
            ? eq(courierShipment.trackingCode, trackingNumber)
            : invoiceNumber
              ? eq(courierShipment.shipmentNo, invoiceNumber)
              : undefined,
        ),
      )
      .limit(1);

    if (!shipment) {
      throw new NotFoundException("No REDX shipment matched this webhook");
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(courierShipment)
        .set({
          providerStatus: dto.status ?? shipment.providerStatus,
          status: nextStatus,
          lastWebhookPayload: dto as JsonValue,
          ...(nextStatus === CourierShipmentStatus.DELIVERED && {
            deliveredAt: shipment.deliveredAt ?? new Date(),
          }),
          ...(nextStatus === CourierShipmentStatus.CANCELLED && {
            cancelledAt: shipment.cancelledAt ?? new Date(),
          }),
        })
        .where(eq(courierShipment.id, shipment.id));

      if (nextStatus === CourierShipmentStatus.DELIVERED) {
        await this.applyDeliveredEffects(tx, shipment, undefined);
      }

      if (nextStatus === CourierShipmentStatus.RETURNED) {
        await this.applyReturnedEffects(tx, shipment, undefined);
      }
    });

    return apiResponse(
      { received: true },
      "REDX webhook processed successfully.",
    );
  }

  private async bookShipment(
    currentUserId: string | undefined,
    businessId: string,
    shipmentId: string,
  ) {
    const shipment = await this.getShipmentOrThrow(businessId, shipmentId);

    if (shipment.trackingCode) {
      return shipment;
    }

    const { runtime } = await this.getActiveRedxRuntime(
      businessId,
      shipment.courierConfigId,
    );
    const [orderRow] = await this.db
      .select()
      .from(order)
      .where(
        and(eq(order.id, shipment.orderId), eq(order.businessId, businessId)),
      )
      .limit(1);

    if (!orderRow) {
      throw new NotFoundException("Order not found for courier shipment");
    }

    const deliveryAddress = this.addressText(shipment.deliveryAddressSnapshot);
    const request = {
      merchantParcelId: shipment.shipmentNo,
      customerName:
        shipment.recipientName ?? orderRow.customerName ?? "Customer",
      customerPhone: shipment.recipientPhone ?? orderRow.customerPhone ?? "",
      deliveryAreaId: this.required(
        shipment.deliveryAreaId,
        "Delivery area is missing",
      ),
      deliveryAreaName: shipment.deliveryAreaName,
      deliveryAddress,
      cashCollectionAmount: Number(new Decimal(shipment.codAmount).toFixed(2)),
      parcelWeight: Number(
        this.payloadObject(shipment.providerRequest).parcelWeight ?? 1,
      ),
      parcelValue: Number(new Decimal(orderRow.totalAmount).toFixed(2)),
      instruction: this.payloadObject(shipment.providerRequest).instruction as
        | string
        | undefined,
      pickupAreaId: this.required(
        shipment.pickupAreaId,
        "Pickup area is missing",
      ),
      pickupAreaName: shipment.pickupAreaName,
      pickupStoreId: shipment.pickupStoreId,
      isClosedBox: runtime.isClosedBox,
    };
    let response: unknown;
    let trackingId: string | null;

    try {
      response = await this.provider.createParcel(runtime, request);
      trackingId = this.provider.extractTrackingId(response);

      if (!trackingId) {
        throw new BadRequestException(
          "REDX parcel was created without a tracking id.",
        );
      }
    } catch (error) {
      await this.db
        .update(courierShipment)
        .set({
          status: CourierShipmentStatus.FAILED,
          providerStatus: "booking-failed",
          providerRequest: request as unknown as JsonValue,
          providerResponse: this.errorPayload(error),
        })
        .where(eq(courierShipment.id, shipment.id));

      throw error;
    }

    const [updated] = await this.db
      .update(courierShipment)
      .set({
        status: CourierShipmentStatus.BOOKED,
        providerStatus: "ready-for-delivery",
        trackingCode: trackingId,
        consignmentId: trackingId,
        providerRequest: request as unknown as JsonValue,
        providerResponse: response as JsonValue,
        shippedAt: new Date(),
        createdBy: shipment.createdBy ?? currentUserId,
      })
      .where(eq(courierShipment.id, shipment.id))
      .returning();

    return updated;
  }

  private async calculateBusinessQuote(
    businessId: string,
    configId: string,
    dto: RedxChargeQuoteDto | StorefrontCourierSelectionDto,
    options: {
      orderId?: string;
      items?: CourierItemMetricInput[];
      collectCash?: boolean;
    } = {},
  ) {
    const { row, runtime } = await this.getActiveRedxRuntime(
      businessId,
      configId,
    );
    const pickupWarehouse = await this.resolvePickupWarehouse(
      businessId,
      dto.warehouseId,
      options.orderId,
    );
    const itemMetrics = options.items
      ? await this.calculateItemMetrics(
          businessId,
          options.items,
          runtime.defaultParcelWeight,
        )
      : null;
    const orderWeight = options.orderId
      ? await this.calculatePersistedOrderWeight(
          businessId,
          options.orderId,
          runtime.defaultParcelWeight,
        )
      : null;
    const requestWeight =
      "weight" in dto && typeof dto.weight === "number" ? dto.weight : null;
    const requestCashCollectionAmount =
      "cashCollectionAmount" in dto &&
      typeof dto.cashCollectionAmount === "number"
        ? dto.cashCollectionAmount
        : null;
    const weight = itemMetrics?.weight ?? orderWeight ?? requestWeight;

    if (weight === null || new Decimal(weight).lessThan(0)) {
      throw new BadRequestException(
        "Courier weight could not be calculated from order items.",
      );
    }

    const cashCollectionAmount = itemMetrics
      ? options.collectCash
        ? itemMetrics.collectableAmount
        : 0
      : (requestCashCollectionAmount ??
        (options.orderId
          ? await this.getOrderCodDueAmount(businessId, options.orderId)
          : 0));
    const charge = await this.provider.calculateCharge(runtime, {
      pickupAreaId: pickupWarehouse.redxAreaId,
      deliveryAreaId: dto.deliveryAreaId,
      weight: Number(new Decimal(weight).toDecimalPlaces(2).toString()),
      cashCollectionAmount,
    });

    return {
      courierId: row.courier.id,
      configId: row.id,
      weight: Number(new Decimal(weight).toDecimalPlaces(2).toString()),
      collectableAmount: Number(
        new Decimal(cashCollectionAmount).toDecimalPlaces(2).toString(),
      ),
      shippingCharge: Number(charge.courierFee.toFixed(2)),
      deliveryCharge: Number(charge.deliveryCharge.toFixed(2)),
      codCharge: Number(charge.codCharge.toFixed(2)),
      courierFee: Number(charge.courierFee.toFixed(2)),
      raw: charge.raw,
      pickupWarehouse: {
        id: pickupWarehouse.id,
        redxAreaId: pickupWarehouse.redxAreaId,
        redxAreaName: pickupWarehouse.redxAreaName,
        redxPostCode: pickupWarehouse.redxPostCode,
        redxPickupStoreId: pickupWarehouse.redxPickupStoreId,
      },
      delivery: {
        areaId: dto.deliveryAreaId,
        areaName: dto.deliveryAreaName ?? null,
        postCode: dto.deliveryPostCode ?? null,
        divisionName: dto.deliveryDivisionName ?? null,
      },
    };
  }

  private async createOrUpdateShipmentForOrder(
    businessId: string,
    orderId: string,
    params: {
      courierId: string;
      courierConfigId: string;
      pickupWarehouseId: string;
      deliveryAreaId: string;
      deliveryAreaName?: string;
      deliveryPostCode?: string;
      deliveryDivisionName?: string;
      weight: number;
      deliveryCharge: number;
      codCharge: number;
      courierFee: number;
      specialInstruction?: string;
      createdBy?: string;
    },
  ) {
    const [orderRow] = await this.db
      .select()
      .from(order)
      .where(and(eq(order.id, orderId), eq(order.businessId, businessId)))
      .limit(1);

    if (!orderRow) {
      throw new NotFoundException("Order not found");
    }

    const [existing] = await this.db
      .select()
      .from(courierShipment)
      .where(
        and(
          eq(courierShipment.businessId, businessId),
          eq(courierShipment.orderId, orderId),
          isNull(courierShipment.deletedAt),
        ),
      )
      .limit(1);

    if (existing?.trackingCode) {
      throw new BadRequestException(
        "This order already has a booked courier shipment",
      );
    }

    const warehouseRow = await this.resolvePickupWarehouse(
      businessId,
      params.pickupWarehouseId,
      orderId,
    );
    const codAmount = orderRow.isCod
      ? new Decimal(orderRow.totalAmount).minus(orderRow.paidAmount)
      : new Decimal(0);
    const base = {
      courierId: params.courierId,
      courierConfigId: params.courierConfigId,
      pickupWarehouseId: warehouseRow.id,
      shippingCharge: new Decimal(params.courierFee),
      codAmount,
      deliveryCharge: new Decimal(params.deliveryCharge),
      codCharge: new Decimal(params.codCharge),
      courierFee: new Decimal(params.courierFee),
      recipientName: orderRow.customerName,
      recipientPhone: orderRow.customerPhone,
      deliveryAreaId: params.deliveryAreaId,
      deliveryAreaName: this.normalizeNullableText(params.deliveryAreaName),
      deliveryPostCode: this.normalizeNullableText(params.deliveryPostCode),
      deliveryDivisionName: this.normalizeNullableText(
        params.deliveryDivisionName,
      ),
      pickupAreaId: warehouseRow.redxAreaId,
      pickupAreaName: warehouseRow.redxAreaName,
      pickupPostCode: warehouseRow.redxPostCode,
      pickupStoreId: warehouseRow.redxPickupStoreId,
      deliveryAddressSnapshot: orderRow.shippingAddressSnapshot,
      providerRequest: {
        parcelWeight: params.weight,
        instruction: this.normalizeNullableText(params.specialInstruction),
      } as JsonValue,
      createdBy: params.createdBy,
    };

    if (existing) {
      const [updated] = await this.db
        .update(courierShipment)
        .set(base)
        .where(eq(courierShipment.id, existing.id))
        .returning();

      return updated;
    }

    const shipmentNo =
      await this.orderCodes.generateUniqueShipmentNo(businessId);
    const [created] = await this.db
      .insert(courierShipment)
      .values({
        businessId,
        orderId,
        shipmentNo,
        ...base,
      })
      .returning();

    const items = await this.db
      .select()
      .from(orderItem)
      .where(eq(orderItem.orderId, orderId));

    if (items.length > 0) {
      await this.db.insert(courierShipmentItem).values(
        items.map((item) => ({
          shipmentId: created.id,
          orderItemId: item.id,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      );
    }

    return created;
  }

  private async calculateItemMetrics(
    businessId: string,
    items: CourierItemMetricInput[],
    defaultWeight?: number,
  ) {
    let weight = new Decimal(0);
    let collectableAmount = new Decimal(0);
    const fallbackWeight = new Decimal(defaultWeight ?? 1);

    for (const item of items) {
      const quantity = new Decimal(item.quantity);
      const details = await this.getItemCourierDetails(
        businessId,
        item.productId,
        item.variantId ?? null,
      );
      const unitWeight =
        details.variantWeight ?? details.productWeight ?? fallbackWeight;
      const unitPrice = details.priceOverride ?? details.price;
      const lineSubtotal = quantity.mul(unitPrice);
      const taxAmount = lineSubtotal
        .mul(details.taxRate)
        .div(100)
        .toDecimalPlaces(2);

      weight = weight.plus(quantity.mul(unitWeight));
      collectableAmount = collectableAmount.plus(lineSubtotal).plus(taxAmount);
    }

    return {
      weight: Number(weight.toDecimalPlaces(2).toString()),
      collectableAmount: Number(
        collectableAmount.toDecimalPlaces(2).toString(),
      ),
    };
  }

  private async calculatePersistedOrderWeight(
    businessId: string,
    orderId: string,
    defaultWeight?: number,
  ) {
    const items = await this.db
      .select({
        productId: orderItem.productId,
        variantId: orderItem.variantId,
        quantity: orderItem.quantity,
      })
      .from(orderItem)
      .innerJoin(order, eq(order.id, orderItem.orderId))
      .where(and(eq(order.id, orderId), eq(order.businessId, businessId)));

    return (await this.calculateItemMetrics(businessId, items, defaultWeight))
      .weight;
  }

  private async getItemCourierDetails(
    businessId: string,
    productId: string,
    variantId: string | null,
  ) {
    const [productRow] = await this.db
      .select({
        id: product.id,
        price: product.price,
        weight: product.weight,
        taxId: product.taxId,
      })
      .from(product)
      .where(
        and(
          eq(product.id, productId),
          eq(product.businessId, businessId),
          eq(product.status, CatalogProductStatus.ACTIVE),
          isNull(product.deletedAt),
        ),
      )
      .limit(1);

    if (!productRow) {
      throw new BadRequestException("One or more order items are invalid");
    }

    const [{ value: variantCount }] = await this.db
      .select({ value: count() })
      .from(productVariant)
      .where(
        and(
          eq(productVariant.businessId, businessId),
          eq(productVariant.productId, productId),
          isNull(productVariant.deletedAt),
        ),
      );

    const selectedVariant = variantId
      ? await this.db
          .select({
            id: productVariant.id,
            priceOverride: productVariant.priceOverride,
            weight: productVariant.weight,
          })
          .from(productVariant)
          .where(
            and(
              eq(productVariant.id, variantId),
              eq(productVariant.productId, productId),
              eq(productVariant.businessId, businessId),
              eq(productVariant.status, ProductVariantStatus.ACTIVE),
              isNull(productVariant.deletedAt),
            ),
          )
          .limit(1)
          .then(([row]) => row ?? null)
      : null;

    if (variantId && !selectedVariant) {
      throw new BadRequestException("One or more order items are invalid");
    }

    if (!variantId && variantCount > 0) {
      throw new BadRequestException(
        "Variant must be selected for a product that has variants",
      );
    }

    const [tax] = await this.db
      .select({ rate: financeTax.rate })
      .from(financeTax)
      .where(
        and(
          eq(financeTax.id, productRow.taxId),
          eq(financeTax.businessId, businessId),
          eq(financeTax.status, FinanceTaxStatus.ACTIVE),
          isNull(financeTax.deletedAt),
        ),
      )
      .limit(1);

    if (!tax) {
      throw new BadRequestException("One or more order item taxes are invalid");
    }

    return {
      price: new Decimal(productRow.price),
      productWeight: productRow.weight ? new Decimal(productRow.weight) : null,
      priceOverride: selectedVariant?.priceOverride
        ? new Decimal(selectedVariant.priceOverride)
        : null,
      variantWeight: selectedVariant?.weight
        ? new Decimal(selectedVariant.weight)
        : null,
      taxRate: new Decimal(tax.rate),
    };
  }

  private async applyDeliveredEffects(
    tx: DatabaseTransaction,
    shipment: CourierShipment,
    changedBy?: string,
  ) {
    const [orderRow] = await tx
      .select()
      .from(order)
      .where(
        and(
          eq(order.id, shipment.orderId),
          eq(order.businessId, shipment.businessId),
        ),
      )
      .limit(1);

    if (!orderRow || orderRow.status === OrderStatus.DELIVERED) {
      await this.ensureCourierReceivable(tx, shipment);
      return;
    }

    const allocations = await tx
      .select({ id: inventoryOrderAllocation.id })
      .from(inventoryOrderAllocation)
      .where(
        and(
          eq(inventoryOrderAllocation.businessId, shipment.businessId),
          eq(inventoryOrderAllocation.orderId, shipment.orderId),
          eq(
            inventoryOrderAllocation.status,
            InventoryOrderAllocationStatus.RESERVED,
          ),
        ),
      );

    for (const allocation of allocations) {
      await this.inventory.fulfillOrderAllocation(
        tx,
        { businessId: shipment.businessId, allocationId: allocation.id },
        changedBy,
      );
    }

    await tx
      .update(order)
      .set({
        status: OrderStatus.DELIVERED,
        paymentStatus: orderRow.isCod
          ? OrderPaymentStatus.PENDING
          : orderRow.paymentStatus,
      })
      .where(eq(order.id, shipment.orderId));

    await tx.insert(orderStatusLog).values({
      orderId: shipment.orderId,
      fromStatus: orderRow.status,
      toStatus: OrderStatus.DELIVERED,
      changedBy,
      note: "REDX delivered webhook",
    });

    await this.ensureCourierReceivable(tx, shipment);
  }

  private async applyReturnedEffects(
    tx: DatabaseTransaction,
    shipment: CourierShipment,
    changedBy?: string,
  ) {
    const [orderRow] = await tx
      .select()
      .from(order)
      .where(
        and(
          eq(order.id, shipment.orderId),
          eq(order.businessId, shipment.businessId),
        ),
      )
      .limit(1);

    if (!orderRow) {
      await this.cancelOpenCourierReceivable(tx, shipment);
      return;
    }

    const allocations = await tx
      .select({ id: inventoryOrderAllocation.id })
      .from(inventoryOrderAllocation)
      .where(
        and(
          eq(inventoryOrderAllocation.businessId, shipment.businessId),
          eq(inventoryOrderAllocation.orderId, shipment.orderId),
          eq(
            inventoryOrderAllocation.status,
            InventoryOrderAllocationStatus.RESERVED,
          ),
        ),
      );

    for (const allocation of allocations) {
      await this.inventory.releaseOrderReservation(
        tx,
        { businessId: shipment.businessId, allocationId: allocation.id },
        changedBy,
      );
    }

    if (
      orderRow.status !== OrderStatus.RETURNED &&
      orderRow.status !== OrderStatus.CANCELLED
    ) {
      await tx
        .update(order)
        .set({ status: OrderStatus.RETURNED })
        .where(eq(order.id, shipment.orderId));

      await tx.insert(orderStatusLog).values({
        orderId: shipment.orderId,
        fromStatus: orderRow.status,
        toStatus: OrderStatus.RETURNED,
        changedBy,
        note: "REDX returned webhook",
      });
    }

    await tx
      .update(invoice)
      .set({ status: InvoiceStatus.CANCELLED })
      .where(
        and(
          eq(invoice.businessId, shipment.businessId),
          eq(invoice.orderId, shipment.orderId),
          ne(invoice.status, InvoiceStatus.PAID),
          isNull(invoice.deletedAt),
        ),
      );

    await this.cancelOpenOrderReceivable(tx, shipment);
    await this.cancelOpenCourierReceivable(tx, shipment);
  }

  private async ensureCourierReceivable(
    tx: DatabaseTransaction,
    shipment: CourierShipment,
  ) {
    if (
      !shipment.courierId ||
      new Decimal(shipment.codAmount).lessThanOrEqualTo(0)
    ) {
      return null;
    }

    const [existing] = await tx
      .select({ id: financeReceivable.id })
      .from(financeReceivable)
      .where(
        and(
          eq(financeReceivable.businessId, shipment.businessId),
          eq(
            financeReceivable.sourceType,
            FinanceSourceType.COURIER_RECEIVABLE,
          ),
          eq(financeReceivable.sourceId, shipment.id),
        ),
      )
      .limit(1);

    if (existing) {
      return existing;
    }

    const netReceivable = new Decimal(shipment.codAmount)
      .minus(shipment.courierFee)
      .toDecimalPlaces(2);

    if (netReceivable.lessThanOrEqualTo(0)) {
      return null;
    }

    const [created] = await tx
      .insert(financeReceivable)
      .values({
        businessId: shipment.businessId,
        receivableNo: await this.financeCodes.generateUniqueReceivableNo(
          shipment.businessId,
        ),
        partyType: FinancePartyType.COURIER,
        partyId: shipment.courierId,
        sourceType: FinanceSourceType.COURIER_RECEIVABLE,
        sourceId: shipment.id,
        totalAmount: netReceivable,
        receivedAmount: new Decimal(0),
        status: FinanceReceivableStatus.PENDING,
        note: `COD receivable for shipment ${shipment.shipmentNo}`,
      })
      .returning();

    return created;
  }

  private async cancelOpenOrderReceivable(
    tx: DatabaseTransaction,
    shipment: CourierShipment,
  ) {
    await tx
      .update(financeReceivable)
      .set({ status: FinanceReceivableStatus.CANCELLED })
      .where(
        and(
          eq(financeReceivable.businessId, shipment.businessId),
          eq(financeReceivable.sourceType, FinanceSourceType.ORDER),
          eq(financeReceivable.sourceId, shipment.orderId),
          ne(financeReceivable.status, FinanceReceivableStatus.RECEIVED),
        ),
      );
  }

  private async cancelOpenCourierReceivable(
    tx: DatabaseTransaction,
    shipment: CourierShipment,
  ) {
    await tx
      .update(financeReceivable)
      .set({ status: FinanceReceivableStatus.CANCELLED })
      .where(
        and(
          eq(financeReceivable.businessId, shipment.businessId),
          eq(
            financeReceivable.sourceType,
            FinanceSourceType.COURIER_RECEIVABLE,
          ),
          eq(financeReceivable.sourceId, shipment.id),
          ne(financeReceivable.status, FinanceReceivableStatus.RECEIVED),
        ),
      );
  }

  private async getActiveRedxRuntime(
    businessId: string,
    configId?: string | null,
  ) {
    if (!configId) {
      throw new BadRequestException("REDX courier config is required");
    }

    const row = await this.getConfigRowOrThrow(businessId, configId);

    if (
      row.status !== CourierConfigStatus.ACTIVE ||
      row.courier.status !== CourierStatus.ACTIVE ||
      row.courier.code !== CourierProvider.REDX
    ) {
      throw new BadRequestException("REDX courier config is not active");
    }

    return {
      row,
      runtime: this.provider.normalizeRedxConfig(
        this.configEncryption.decrypt(row.configData),
        row.mode,
      ),
    };
  }

  private async getConfigRowOrThrow(businessId: string, configId: string) {
    const [row] = await this.db
      .select({ config: courierConfig, courier })
      .from(courierConfig)
      .innerJoin(courier, eq(courier.id, courierConfig.courierId))
      .where(
        and(
          eq(courierConfig.id, configId),
          eq(courierConfig.businessId, businessId),
          isNull(courierConfig.deletedAt),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException("Courier config not found");
    }

    return { ...row.config, courier: row.courier };
  }

  private async getShipmentOrThrow(businessId: string, shipmentId: string) {
    const [shipment] = await this.db
      .select()
      .from(courierShipment)
      .where(
        and(
          eq(courierShipment.id, shipmentId),
          eq(courierShipment.businessId, businessId),
          isNull(courierShipment.deletedAt),
        ),
      )
      .limit(1);

    if (!shipment) {
      throw new NotFoundException("Courier shipment not found");
    }

    return shipment;
  }

  private async resolvePickupWarehouse(
    businessId: string,
    warehouseId?: string,
    orderId?: string,
  ): Promise<RedxPickupWarehouse> {
    const resolvedWarehouseId =
      warehouseId ??
      (orderId ? await this.getOrderWarehouseId(businessId, orderId) : null) ??
      (await this.getDefaultWarehouseId(businessId));

    const [row] = await this.db
      .select()
      .from(warehouse)
      .where(
        and(
          eq(warehouse.id, resolvedWarehouseId),
          eq(warehouse.businessId, businessId),
          eq(warehouse.status, WarehouseStatus.ACTIVE),
          isNull(warehouse.deletedAt),
        ),
      )
      .limit(1);

    if (!row) {
      throw new BadRequestException("Pickup warehouse is missing or inactive");
    }

    if (!row.redxAreaId || !row.redxAreaName) {
      throw new BadRequestException(
        "Pickup warehouse must have REDX area metadata before REDX can be used",
      );
    }

    return row as RedxPickupWarehouse;
  }

  private async getDefaultWarehouseId(businessId: string) {
    const [settings] = await this.db
      .select({ defaultWarehouseId: businessSetting.defaultWarehouseId })
      .from(businessSetting)
      .where(eq(businessSetting.businessId, businessId))
      .limit(1);

    if (!settings?.defaultWarehouseId) {
      throw new BadRequestException(
        "Default warehouse is required for REDX pickup",
      );
    }

    return settings.defaultWarehouseId;
  }

  private async getOrderWarehouseId(businessId: string, orderId: string) {
    const [orderRow] = await this.db
      .select({ warehouseId: order.warehouseId })
      .from(order)
      .where(and(eq(order.id, orderId), eq(order.businessId, businessId)))
      .limit(1);

    return orderRow?.warehouseId ?? null;
  }

  private async getOrderCodDueAmount(businessId: string, orderId: string) {
    const [orderRow] = await this.db
      .select({
        isCod: order.isCod,
        totalAmount: order.totalAmount,
        paidAmount: order.paidAmount,
      })
      .from(order)
      .where(and(eq(order.id, orderId), eq(order.businessId, businessId)))
      .limit(1);

    if (!orderRow?.isCod) {
      return 0;
    }

    return Number(new Decimal(orderRow.totalAmount).minus(orderRow.paidAmount));
  }

  private serializeConfig(row: CourierConfigRow) {
    const decrypted = this.configEncryption.decrypt(row.configData);

    return {
      ...row,
      configData: this.provider.redactRedxConfig(decrypted),
      baseUrl: this.provider.resolveRedxBaseUrl(row.mode),
      webhookTokenHash: undefined,
      webhookConfigured: Boolean(row.webhookTokenHash),
      webhookUrlHint: `${this.appConfig.publicApiUrl}/couriers/webhooks/redx?token=<token>`,
    };
  }

  private assertRedxConfigUsable(
    config: Record<string, unknown>,
    mode: CourierConfigMode,
  ) {
    this.provider.normalizeRedxConfig(config, mode);
  }

  private buildWebhookUrl(token: string) {
    return `${this.appConfig.publicApiUrl}/couriers/webhooks/redx?token=${encodeURIComponent(token)}`;
  }

  private generateWebhookToken() {
    return randomBytes(32).toString("hex");
  }

  private hashWebhookToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private matchesWebhookToken(token: string, hash: string | null) {
    if (!hash) {
      return false;
    }

    const expected = Buffer.from(hash, "hex");
    const actual = Buffer.from(this.hashWebhookToken(token), "hex");

    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  }

  private normalizeNullableText(value?: string | null) {
    const normalized = value?.trim();

    return normalized || null;
  }

  private required(value: string | null, message: string) {
    if (!value) {
      throw new BadRequestException(message);
    }

    return value;
  }

  private payloadObject(value: JsonValue | undefined): Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? value
      : {};
  }

  private addressText(value: JsonValue | undefined) {
    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const object = value as Record<string, unknown>;

      for (const key of ["address", "street", "line1"]) {
        if (typeof object[key] === "string" && object[key].trim()) {
          return object[key].trim();
        }
      }

      return JSON.stringify(object);
    }

    return "Delivery address";
  }

  private errorPayload(error: unknown): JsonValue {
    if (
      typeof error === "object" &&
      error !== null &&
      "getResponse" in error &&
      typeof (error as { getResponse?: unknown }).getResponse === "function"
    ) {
      const response = (error as { getResponse: () => unknown }).getResponse();

      if (this.isJsonValue(response)) {
        return response;
      }
    }

    if (typeof error === "object" && error !== null && "response" in error) {
      const response = (error as { response?: unknown }).response;

      if (this.isJsonValue(response)) {
        return response;
      }
    }

    if (error instanceof Error) {
      return {
        message: error.message,
        name: error.name,
      };
    }

    return {
      message: String(error),
    };
  }

  private isJsonValue(value: unknown): value is JsonValue {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return true;
    }

    if (Array.isArray(value)) {
      return value.every((item) => this.isJsonValue(item));
    }

    if (typeof value === "object") {
      return Object.values(value).every((item) => this.isJsonValue(item));
    }

    return false;
  }
}
