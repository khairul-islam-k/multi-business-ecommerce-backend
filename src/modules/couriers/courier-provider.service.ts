import Decimal from "decimal.js";

import { CourierConfigMode, CourierShipmentStatus } from "@/database/schema";
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";

export const REDX_LIVE_BASE_URL = "https://openapi.redx.com.bd";
export const REDX_SANDBOX_BASE_URL = "https://sandbox.redx.com.bd";

export type RedxConfig = {
  apiAccessToken: string;
  baseUrl: string;
  mode: CourierConfigMode;
  defaultParcelWeight?: number;
  defaultParcelValue?: number;
  isClosedBox?: boolean;
  instruction?: string;
};

export type RedxAreaQuery = {
  postCode?: string | number;
  districtName?: string;
};

export type RedxChargeRequest = {
  pickupAreaId: string | number;
  deliveryAreaId: string | number;
  weight: number;
  cashCollectionAmount: Decimal.Value;
};

export type RedxParcelRequest = {
  merchantParcelId: string;
  customerName: string;
  customerPhone: string;
  deliveryAreaId: string | number;
  deliveryAreaName?: string | null;
  deliveryAddress: string;
  cashCollectionAmount: Decimal.Value;
  parcelWeight: number;
  parcelValue?: Decimal.Value;
  instruction?: string | null;
  pickupAreaId: string | number;
  pickupAreaName?: string | null;
  pickupStoreId?: string | number | null;
  isClosedBox?: boolean;
};

export type RedxPickupStoreRequest = {
  name: string;
  phone: string;
  address: string;
  areaId: string | number;
};

export type RedxPickupStoreUpdateRequest = Partial<RedxPickupStoreRequest>;

export type RedxWebhookPayload = {
  tracking_number?: string;
  timestamp?: string;
  status?: string;
  message_en?: string;
  message_bn?: string;
  invoice_number?: string;
  delivery_type?: string;
  [key: string]: unknown;
};

@Injectable()
export class CourierProviderService {
  normalizeRedxConfig(
    config: Record<string, unknown>,
    mode: CourierConfigMode = CourierConfigMode.LIVE,
  ): RedxConfig {
    const apiAccessToken = this.requiredString(
      config.apiAccessToken,
      "REDX API access token is required before activating or using REDX.",
    );

    return {
      apiAccessToken,
      baseUrl: this.resolveRedxBaseUrl(mode),
      mode,
      defaultParcelWeight: this.optionalNumber(config.defaultParcelWeight),
      defaultParcelValue: this.optionalNumber(config.defaultParcelValue),
      isClosedBox:
        typeof config.isClosedBox === "boolean" ? config.isClosedBox : true,
      instruction: this.optionalString(config.instruction),
    };
  }

  redactRedxConfig(config: Record<string, unknown>) {
    return this.sanitizeRedxConfigData(config);
  }

  sanitizeRedxConfigData(config: Record<string, unknown>) {
    const sanitized = { ...config };
    delete sanitized.baseUrl;
    delete sanitized.mode;

    return sanitized;
  }

  resolveRedxBaseUrl(mode: CourierConfigMode = CourierConfigMode.LIVE) {
    return mode === CourierConfigMode.SANDBOX
      ? REDX_SANDBOX_BASE_URL
      : REDX_LIVE_BASE_URL;
  }

  async getAreas(config: RedxConfig, query: RedxAreaQuery = {}) {
    const params = new URLSearchParams();

    if (query.postCode !== undefined) {
      params.set("post_code", String(query.postCode));
    }

    if (query.districtName) {
      params.set("district_name", query.districtName);
    }

    const suffix = params.toString() ? `?${params.toString()}` : "";
    return this.request(config, `/v1.0.0-beta/areas${suffix}`);
  }

  async calculateCharge(config: RedxConfig, dto: RedxChargeRequest) {
    const response = await this.request(
      config,
      "/v1.0.0-beta/charge/charge_calculator",
      {
        method: "GET",
        query: {
          pickup_area_id: String(dto.pickupAreaId),
          delivery_area_id: String(dto.deliveryAreaId),
          weight: String(dto.weight),
          cash_collection_amount: new Decimal(dto.cashCollectionAmount).toFixed(
            2,
          ),
        },
      },
    );

    const deliveryCharge = this.moneyFromPayload(response, [
      "delivery_charge",
      "deliveryCharge",
      "charge",
      "total_charge",
    ]);
    const codCharge = this.moneyFromPayload(response, [
      "cod_charge",
      "codCharge",
    ]);

    return {
      raw: response,
      deliveryCharge,
      codCharge,
      courierFee: deliveryCharge.plus(codCharge),
    };
  }

  async createParcel(config: RedxConfig, dto: RedxParcelRequest) {
    const payload = {
      merchant_parcel_id: dto.merchantParcelId,
      customer_name: dto.customerName,
      customer_phone: dto.customerPhone,
      customer_address: dto.deliveryAddress,
      delivery_area: dto.deliveryAreaName,
      delivery_area_id: Number(dto.deliveryAreaId),
      delivery_address: dto.deliveryAddress,
      cash_collection_amount: Number(
        new Decimal(dto.cashCollectionAmount).toFixed(2),
      ),
      parcel_weight: dto.parcelWeight,
      value:
        dto.parcelValue === undefined
          ? undefined
          : new Decimal(dto.parcelValue).toFixed(2),
      parcel_value:
        dto.parcelValue === undefined
          ? undefined
          : Number(new Decimal(dto.parcelValue).toFixed(2)),
      instruction: dto.instruction ?? undefined,
      pickup_area_id: Number(dto.pickupAreaId),
      pickup_area: dto.pickupAreaName ?? undefined,
      pickup_store_id: dto.pickupStoreId
        ? Number(dto.pickupStoreId)
        : undefined,
      is_closed_box: dto.isClosedBox ?? true,
    };

    return this.request(config, "/v1.0.0-beta/parcel", {
      method: "POST",
      body: payload,
    });
  }

  getParcelInfo(config: RedxConfig, trackingId: string) {
    return this.request(
      config,
      `/v1.0.0-beta/parcel/info/${encodeURIComponent(trackingId)}`,
    );
  }

  trackParcel(config: RedxConfig, trackingId: string) {
    return this.request(
      config,
      `/v1.0.0-beta/parcel/track/${encodeURIComponent(trackingId)}`,
    );
  }

  updateParcel(config: RedxConfig, payload: Record<string, unknown>) {
    return this.request(config, "/v1.0.0-beta/parcels", {
      method: "PATCH",
      body: payload,
    });
  }

  createPickupStore(config: RedxConfig, dto: RedxPickupStoreRequest) {
    return this.request(config, "/v1.0.0-beta/pickup/store", {
      method: "POST",
      body: {
        name: dto.name,
        phone: dto.phone,
        address: dto.address,
        area_id: Number(dto.areaId),
      },
    });
  }

  // updatePickupStore(
  //   config: RedxConfig,
  //   storeId: string,
  //   dto: RedxPickupStoreUpdateRequest,
  // ) {
  //   return this.request(
  //     config,
  //     `/v1.0.0-beta/pickup/stores/${encodeURIComponent(storeId)}`,
  //     {
  //       method: "PATCH",
  //       body: this.buildPickupStorePayload(dto),
  //     },
  //   );
  // }

  // deletePickupStore(config: RedxConfig, storeId: string) {
  //   return this.request(
  //     config,
  //     `/v1.0.0-beta/pickup/stores/${encodeURIComponent(storeId)}`,
  //     { method: "DELETE" },
  //   );
  // }

  listPickupStores(config: RedxConfig) {
    return this.request(config, "/v1.0.0-beta/pickup/stores");
  }

  getPickupStoreDetails(config: RedxConfig, storeId: string) {
    return this.request(
      config,
      `/v1.0.0-beta/pickup/store/info/${encodeURIComponent(storeId)}`,
    );
  }

  private buildPickupStorePayload(
    dto: RedxPickupStoreUpdateRequest,
  ): Record<string, unknown> {
    return {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.address !== undefined && { address: dto.address }),
      ...(dto.areaId !== undefined && { area_id: Number(dto.areaId) }),
    };
  }

  mapWebhookStatus(status?: string | null) {
    switch (status?.trim().toLowerCase()) {
      case "ready-for-delivery":
        return CourierShipmentStatus.BOOKED;
      case "delivery-in-progress":
      case "agent-hold":
      case "agent-area-change":
        return CourierShipmentStatus.IN_TRANSIT;
      case "delivered":
        return CourierShipmentStatus.DELIVERED;
      case "delivery-failed":
      case "failed-delivery":
      case "failed":
      case "lost":
      case "damaged":
        return CourierShipmentStatus.FAILED;
      case "agent-returning":
      case "returned":
        return CourierShipmentStatus.RETURNED;
      case "cancelled":
      case "canceled":
        return CourierShipmentStatus.CANCELLED;
      default:
        return CourierShipmentStatus.PENDING;
    }
  }

  extractTrackingId(payload: unknown) {
    return (
      this.findString(payload, [
        "tracking_id",
        "trackingId",
        "tracking_number",
        "trackingNumber",
        "consignment_id",
      ]) ?? null
    );
  }

  extractProviderStatus(payload: unknown) {
    return (
      this.findString(payload, [
        "status",
        "current_status",
        "currentStatus",
        "parcel_status",
        "parcelStatus",
      ]) ?? null
    );
  }

  private async request(
    config: RedxConfig,
    endpoint: string,
    options: {
      method?: "GET" | "POST" | "PATCH" | "DELETE";
      query?: Record<string, string>;
      body?: Record<string, unknown>;
    } = {},
  ) {
    const query = options.query
      ? `?${new URLSearchParams(options.query).toString()}`
      : "";
    const response = await fetch(`${config.baseUrl}${endpoint}${query}`, {
      method: options.method ?? "GET",
      headers: {
        "API-ACCESS-TOKEN": `Bearer ${config.apiAccessToken}`,
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const payload = await this.parseResponse(response);

    if (!response.ok) {
      const message =
        typeof payload === "object"
          ? (payload as { message: string }).message
          : null;
      throw new BadRequestException({
        message: message
          ? `REDX request failed: ${message}`
          : "REDX request failed",
        statusCode: response.status,
        response: payload,
      });
    }

    return payload;
  }

  private async parseResponse(response: Response) {
    const text = await response.text();

    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new InternalServerErrorException("REDX returned invalid JSON");
    }
  }

  private moneyFromPayload(payload: unknown, keys: string[]) {
    const value = this.findNumber(payload, keys);
    return new Decimal(value ?? 0).toDecimalPlaces(2);
  }

  private findString(payload: unknown, keys: string[]): string | undefined {
    if (typeof payload !== "object" || payload === null) {
      return undefined;
    }

    for (const [key, value] of Object.entries(payload)) {
      if (keys.includes(key) && typeof value === "string" && value.trim()) {
        return value.trim();
      }

      if (typeof value === "object" && value !== null) {
        const nested = this.findString(value, keys);

        if (nested) {
          return nested;
        }
      }
    }

    return undefined;
  }

  private findNumber(payload: unknown, keys: string[]): number | undefined {
    if (typeof payload !== "object" || payload === null) {
      return undefined;
    }

    for (const [key, value] of Object.entries(payload)) {
      if (keys.includes(key)) {
        if (typeof value === "number") {
          return value;
        }

        if (typeof value === "string" && value.trim()) {
          return Number(value);
        }
      }

      if (typeof value === "object" && value !== null) {
        const nested = this.findNumber(value, keys);

        if (nested !== undefined) {
          return nested;
        }
      }
    }

    return undefined;
  }

  private requiredString(value: unknown, message: string) {
    const normalized = this.optionalString(value);

    if (!normalized) {
      throw new BadRequestException(message);
    }

    return normalized;
  }

  private optionalString(value: unknown) {
    if (typeof value !== "string") {
      return undefined;
    }

    return value.trim() || undefined;
  }

  private optionalNumber(value: unknown) {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    const numberValue = Number(value);

    return Number.isFinite(numberValue) ? numberValue : undefined;
  }
}
