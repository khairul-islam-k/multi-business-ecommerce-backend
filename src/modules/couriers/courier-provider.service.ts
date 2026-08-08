import Decimal from "decimal.js";

import {
  CourierConfigMode,
  CourierProvider,
  CourierShipmentStatus,
} from "@/database/schema";
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";

export const REDX_LIVE_BASE_URL = "https://openapi.redx.com.bd";
export const REDX_SANDBOX_BASE_URL = "https://sandbox.redx.com.bd";

export const PATHAO_LIVE_BASE_URL = "https://api-hermes.pathao.com";
export const PATHAO_SANDBOX_BASE_URL = "https://courier-api-sandbox.pathao.com";

export type RedxConfig = {
  apiAccessToken: string;
  refreshToken?: string;
  baseUrl?: string;
  mode: CourierConfigMode;
  defaultParcelWeight?: number;
  defaultParcelValue?: number;
  isClosedBox?: boolean;
  instruction?: string;
  clientId?: string;
  clientSecret?: string;
  email?: string;
  password?: string;
  code: CourierProvider;
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

export type RedxPickupStoreRequest = Record<string, unknown>;

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

type CommonStoreResponse = {
  data: {
    store_id: number;
    store_name: string;
    area_name: string | null;
    area_id: number | null;
    phone: string | null;
  };
};

type CommonStoreListResponse = {
  stores: {
    store_id: number;
    store_name: string;
    store_address: string | null;
    area_name: string | null;
    area_id: number | null;
    phone: string | null;
    city_id: number | null;
    zone_id: number | null;
    is_active: boolean | null;
  }[];
};

@Injectable()
export class CourierProviderService {
  normalizeCourierConfig(
    code: string,
    config: Record<string, unknown>,
    mode: CourierConfigMode = CourierConfigMode.LIVE,
  ): RedxConfig {
    switch (code) {
      case "REDX": {
        const apiAccessToken = this.requiredString(
          config.apiAccessToken,
          "REDX API access token is required before activating or using REDX.",
        );

        return {
          apiAccessToken,
          baseUrl: this.resolveRedxBaseUrl(mode),
          mode,
          code,
          defaultParcelWeight: this.optionalNumber(config.defaultParcelWeight),
          defaultParcelValue: this.optionalNumber(config.defaultParcelValue),
          isClosedBox:
            typeof config.isClosedBox === "boolean" ? config.isClosedBox : true,
          instruction: this.optionalString(config.instruction),
        };
      }

      case "PATHAO": {
        const accessToken = this.requiredString(
          config.accessToken,
          "PATHAO access token is required before activating or using PATHAO.",
        );

        return {
          apiAccessToken: accessToken,
          refreshToken: this.optionalString(config.refreshToken),
          clientId: this.optionalString(config.clientId),
          clientSecret: this.optionalString(config.clientSecret),
          email: this.optionalString(config.email),
          password: this.optionalString(config.password),
          mode,
          code,
        };
      }

      default:
        throw new BadRequestException(`Unsupported courier provider: ${code}`);
    }
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

    switch (config.code) {
      case "REDX": {
        if (query.postCode !== undefined) {
          params.set("post_code", String(query.postCode));
        }

        if (query.districtName) {
          params.set("district_name", query.districtName);
        }

        const suffix = params.toString() ? `?${params.toString()}` : "";

        const response = await this.apiRequest(
          config,
          `/v1.0.0-beta/areas${suffix}`,
        );
        return this.normalizeCityResponse(config.code, response);
      }

      case "PATHAO": {
        const response = await this.apiRequest(
          config,
          "/aladdin/api/v1/city-list",
        );

        return this.normalizeCityResponse(config.code, response);
      }

      default: {
        throw new BadRequestException(`Unsupported courier provider`);
      }
    }
  }

  private normalizeCityResponse(code: CourierProvider, payload: unknown) {
    switch (code) {
      case "PATHAO": {
        const response = payload as {
          message?: string;
          type?: string;
          data?: {
            data?: Array<{
              city_id: number;
              city_name: string;
            }>;
          };
        };

        return {
          data: {
            areas:
              response.data?.data?.map((item) => ({
                city_id: item.city_id,
                city_name: item.city_name.trim(),
                post_code: null,
                district_name: null,
                division_name: null,
                zone_id: null,
              })) ?? [],
            message: response.message ?? "City successfully fetched.",
            type: response.type ?? "success",
          },
        };
      }

      case "REDX": {
        const response = payload as {
          areas?: Array<{
            id: number;
            name: string;
            post_code?: number;
            district_name?: string;
            division_name?: string;
            zone_id?: number;
          }>;
        };

        return {
          data: {
            areas:
              response.areas?.map((item) => ({
                city_id: item.id,
                city_name: item.name.trim(),
                post_code: item.post_code ?? null,
                district_name: item.district_name ?? null,
                division_name: item.division_name ?? null,
                zone_id: item.zone_id ?? null,
              })) ?? [],
            message: "City successfully fetched.",
            type: "success",
          },
        };
      }

      default:
        throw new BadRequestException(`Unsupported courier provider`);
    }
  }

  async getZonesInsideCity(config: RedxConfig, cityId: string) {
    const response = await this.apiRequest(
      config,
      `/aladdin/api/v1/cities/${cityId}/zone-list`,
    );
    return response;
  }

  async getAreaInsideZone(config: RedxConfig, zoneId: string) {
    const response = await this.apiRequest(
      config,
      `/aladdin/api/v1/zones/${zoneId}/area-list`,
    );
    return response;
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

  async createPickupStore(config: RedxConfig, dto: RedxPickupStoreRequest) {
    switch (config.code) {
      case "REDX": {
        const res = await this.apiRequest(config, "/v1.0.0-beta/pickup/store", {
          method: "POST",
          body: dto,
        });
        console.log("res api", res);
        return this.normalizeStoreResponse(config.code, res);
      }
      case "PATHAO": {
        const res = await this.apiRequest(config, "/aladdin/api/v1/stores", {
          method: "POST",
          body: dto,
        });
        return this.normalizeStoreResponse(config.code, res);
      }
      default:
        break;
    }
  }

  private normalizeStoreResponse(
    provider: CourierProvider,
    response: unknown,
  ): CommonStoreResponse {
    console.log("res", response);
    switch (provider) {
      case "PATHAO": {
        const pathaoResponse = response as {
          message: string;
          type: string;
          code: number;
          data: {
            store_id: number;
            store_name: string;
          };
        };

        const store = pathaoResponse.data;

        return {
          data: {
            store_id: store.store_id,
            store_name: store.store_name,
            area_name: null,
            area_id: null,
            phone: null,
          },
        };
      }

      case "REDX": {
        const redxResponse = response as {
          id: number;
          name: string;
          address: string;
          area_name: string;
          area_id: number;
          phone: string;
        };
        const store = redxResponse;

        return {
          data: {
            store_id: store.id,
            store_name: store.name,
            area_name: store.area_name,
            area_id: store.area_id,
            phone: store.phone,
          },
        };
      }

      default:
        throw new BadRequestException("Unsupported courier provider");
    }
  }

  async listPickupStores(config: RedxConfig) {
    switch (config.code) {
      case "REDX": {
        const res = await this.apiRequest(config, "/v1.0.0-beta/pickup/stores");
        return this.normalizeStoreListResponse(config.code, res);
      }
      case "PATHAO": {
        const res = await this.apiRequest(config, "/aladdin/api/v1/stores");
        return this.normalizeStoreListResponse(config.code, res);
      }
      default:
        break;
    }
  }

  private normalizeStoreListResponse(
    provider: CourierProvider,
    response: unknown,
  ): CommonStoreListResponse {
    console.log("res", response);
    switch (provider) {
      case "REDX": {
        const redxResponse = response as {
          pickup_stores: {
            id: number;
            name: string;
            address: string;
            area_name: string;
            area_id: number;
            phone: string;
            created_at: string;
          }[];
        };

        return {
          stores: redxResponse.pickup_stores.map((store) => ({
            store_id: store.id,
            store_name: store.name,
            store_address: store.address,
            area_name: store.area_name,
            area_id: store.area_id,
            phone: store.phone,
            city_id: null,
            zone_id: null,
            is_active: null,
          })),
        };
      }

      case "PATHAO": {
        const pathaoResponse = response as {
          message: string;
          type: string;
          code: number;
          data: {
            data: {
              store_id: number;
              store_name: string;
              store_address: string;
              is_active: number;
              city_id: number;
              zone_id: number;
              hub_id: number;
              is_default_store: boolean;
              is_default_return_store: boolean;
            }[];
          };
        };

        return {
          stores: pathaoResponse.data.data.map((store) => ({
            store_id: store.store_id,
            store_name: store.store_name,
            store_address: store.store_address,
            area_name: null,
            area_id: null,
            phone: null,
            city_id: store.city_id,
            zone_id: store.zone_id,
            is_active: store.is_active === 1,
          })),
        };
      }

      default:
        throw new BadRequestException("Unsupported courier provider");
    }
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

  // FOR PATHAO
  async getAccessTokenAndRefreshToke(
    mode: CourierConfigMode,
    code: CourierProvider,
    dto: Record<string, unknown>,
  ): Promise<{
    access_token: string;
    refresh_token: string;
  }> {
    const baseUrl = this.getBaseUrl(mode, code);

    const pathaoPayload = {
      client_id: dto.clientId,
      client_secret: dto.clientSecret,
      grant_type: "password",
      username: dto.email,
      password: dto.password,
    };

    const response = await fetch(`${baseUrl}/aladdin/api/v1/issue-token`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pathaoPayload),
    });

    const payload = await this.parseResponse(response);

    if (!response.ok) {
      const message =
        typeof payload === "object"
          ? (payload as { message: string }).message
          : null;
      throw new BadRequestException({
        message: message
          ? `PATHAO request failed: ${message}`
          : "PATHAO request failed",
        statusCode: response.status,
        response: payload,
      });
    }

    if (
      typeof payload !== "object" ||
      payload === null ||
      !("access_token" in payload) ||
      !("refresh_token" in payload) ||
      typeof payload.access_token !== "string" ||
      typeof payload.refresh_token !== "string"
    ) {
      throw new BadRequestException({
        message: "PATHAO returned an invalid token response.",
        statusCode: response.status,
        response: payload,
      });
    }

    return {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
    };
  }

  private getBaseUrl(mode: CourierConfigMode, code: CourierProvider) {
    switch (code) {
      case CourierProvider.PATHAO:
        return mode === "SANDBOX"
          ? PATHAO_SANDBOX_BASE_URL
          : PATHAO_LIVE_BASE_URL;
      case CourierProvider.REDX:
        return mode === "SANDBOX" ? REDX_SANDBOX_BASE_URL : REDX_LIVE_BASE_URL;

      default:
        return "";
    }
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

  // I want to change it
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

  private async apiRequest(
    config: RedxConfig,
    endpoint: string,
    options: {
      method?: "GET" | "POST" | "PATCH" | "DELETE";
      query?: Record<string, string>;
      body?: Record<string, unknown>;
    } = {},
  ) {
    console.log("config", config);
    const query = options.query
      ? `?${new URLSearchParams(options.query).toString()}`
      : "";
    const response = await fetch(
      `${this.getBaseUrl(config.mode, config.code)}${endpoint}${query}`,
      {
        method: options.method ?? "GET",

        headers:
          config.code === "REDX"
            ? {
                "API-ACCESS-TOKEN": `Bearer ${config.apiAccessToken}`,
                Accept: "application/json",
                ...(options.body ? { "Content-Type": "application/json" } : {}),
              }
            : {
                Authorization: `Bearer ${config.apiAccessToken}`,
                Accept: "application/json",
                "Content-Type": "application/json; charset=UTF-8",
              },

        body: options.body ? JSON.stringify(options.body) : undefined,
      },
    );

    const payload = await this.parseResponse(response);

    if (!response.ok) {
      const errorPayload = payload as {
        message?: string;
        errors?: {
          name?: string[];
        };
      };

      const message = errorPayload.message ?? null;

      console.log("message", response, errorPayload.errors?.name);

      throw new BadRequestException({
        message: message
          ? `Courier request failed: ${errorPayload?.errors?.name?.[0]} ${message}`
          : "Courier request failed",
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
      throw new InternalServerErrorException("Courier returned invalid JSON");
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
