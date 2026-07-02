import Decimal from "decimal.js";

import {
  CourierConfigMode,
  CourierProvider,
  CourierShipmentStatus,
} from "@/database/schema";
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from "@nestjs/common";

type PathaoConfig = {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  storeId: number;
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: string;
  deliveryType?: 12 | 48;
  itemType?: 1 | 2;
  itemWeight?: number;
  specialInstruction?: string;
  itemDescription?: string;
};

type SteadfastConfig = {
  apiKey: string;
  secretKey: string;
  deliveryType?: 0 | 1;
  note?: string;
  itemDescription?: string;
};

type RedxConfig = {
  apiAccessToken: string;
  baseUrl: string;
  pickupStoreId?: number;
  parcelWeight?: number;
  parcelValue?: number;
  deliveryArea?: string;
  deliveryAreaId?: number;
  instruction?: string;
  isClosedBox?: boolean;
};

type PathaoTokenResponse = {
  token_type?: string;
  expires_in?: number;
  access_token?: string;
  refresh_token?: string;
};

type PathaoResponse<T> = {
  message?: string;
  type?: string;
  code?: number;
  data?: T;
};

export type PathaoCreateStoreParams = {
  name: string;
  contactName: string;
  contactNumber: string;
  secondaryContact?: string;
  otpNumber?: string;
  address: string;
  cityId: number;
  zoneId: number;
  areaId: number;
};

export type PathaoPricePlanParams = {
  itemType: 1 | 2;
  deliveryType: 12 | 48;
  itemWeight: number;
  recipientCity: number;
  recipientZone: number;
};

export type PathaoCreateOrderParams = {
  shipmentNo: string;
  merchantOrderId?: string;
  recipientName: string;
  recipientPhone: string;
  recipientSecondaryPhone?: string;
  recipientAddress: string;
  recipientCity?: number;
  recipientZone?: number;
  recipientArea?: number;
  deliveryType?: 12 | 48;
  itemType?: 1 | 2;
  specialInstruction?: string;
  itemQuantity: number;
  itemWeight?: number;
  itemDescription?: string;
  amountToCollect: Decimal.Value;
};

export type PathaoRuntime = {
  config: PathaoConfig;
  accessToken: string;
};

export type CourierBookingParams = {
  shipmentNo: string;
  orderNo: string;
  recipientName: string;
  recipientPhone: string;
  recipientSecondaryPhone?: string;
  recipientAddress: string;
  codAmount: Decimal.Value;
  itemQuantity: number;
  itemWeight?: number;
  itemDescription?: string;
  specialInstruction?: string;
  pathao?: {
    recipientCity?: number;
    recipientZone?: number;
    recipientArea?: number;
    deliveryType?: 12 | 48;
    itemType?: 1 | 2;
  };
  steadfast?: {
    deliveryType?: 0 | 1;
  };
  redx?: {
    deliveryArea?: string;
    deliveryAreaId?: number;
    pickupStoreId?: number;
    parcelWeight?: number;
    parcelValue?: number;
    isClosedBox?: boolean;
  };
};

const PATHAO_BASE_URLS: Record<CourierConfigMode, string> = {
  [CourierConfigMode.SANDBOX]: "https://courier-api-sandbox.pathao.com",
  [CourierConfigMode.LIVE]: "https://api-hermes.pathao.com",
};

@Injectable()
export class CourierProviderService {
  normalizeConfig(
    provider: CourierProvider,
    rawConfig: Record<string, unknown>,
  ): Record<string, unknown> {
    switch (provider) {
      case CourierProvider.PATHAO:
        return this.normalizePathaoConfig(rawConfig);
      case CourierProvider.STEADFAST:
        return this.normalizeSteadfastConfig(rawConfig);
      case CourierProvider.REDX:
        return this.normalizeRedxConfig(rawConfig);
    }
  }

  normalizePathaoConfig(rawConfig: Record<string, unknown>): PathaoConfig {
    return {
      clientId: this.requiredString(rawConfig, "clientId"),
      clientSecret: this.requiredString(rawConfig, "clientSecret"),
      username: this.requiredString(rawConfig, "username"),
      password: this.requiredString(rawConfig, "password"),
      storeId: this.requiredInteger(rawConfig, "storeId"),
      accessToken: this.optionalString(rawConfig, "accessToken") ?? undefined,
      refreshToken: this.optionalString(rawConfig, "refreshToken") ?? undefined,
      accessTokenExpiresAt:
        this.optionalString(rawConfig, "accessTokenExpiresAt") ?? undefined,
      deliveryType: this.optionalEnum(rawConfig, "deliveryType", [12, 48]),
      itemType: this.optionalEnum(rawConfig, "itemType", [1, 2]),
      itemWeight: this.optionalWeight(rawConfig, "itemWeight"),
      specialInstruction:
        this.optionalString(rawConfig, "specialInstruction") ?? undefined,
      itemDescription:
        this.optionalString(rawConfig, "itemDescription") ?? undefined,
    };
  }

  normalizeSteadfastConfig(
    rawConfig: Record<string, unknown>,
  ): SteadfastConfig {
    return {
      apiKey: this.requiredString(rawConfig, "apiKey"),
      secretKey: this.requiredString(rawConfig, "secretKey"),
      deliveryType: this.optionalEnum(rawConfig, "deliveryType", [0, 1]),
      note: this.optionalString(rawConfig, "note") ?? undefined,
      itemDescription:
        this.optionalString(rawConfig, "itemDescription") ?? undefined,
    };
  }

  normalizeRedxConfig(rawConfig: Record<string, unknown>): RedxConfig {
    const baseUrl = this.requiredString(rawConfig, "baseUrl").replace(
      /\/$/,
      "",
    );

    return {
      apiAccessToken: this.requiredString(rawConfig, "apiAccessToken"),
      baseUrl,
      pickupStoreId: this.optionalPositiveInteger(rawConfig, "pickupStoreId"),
      parcelWeight: this.optionalPositiveNumber(rawConfig, "parcelWeight"),
      parcelValue: this.optionalPositiveNumber(rawConfig, "parcelValue"),
      deliveryArea: this.optionalString(rawConfig, "deliveryArea") ?? undefined,
      deliveryAreaId: this.optionalPositiveInteger(rawConfig, "deliveryAreaId"),
      instruction: this.optionalString(rawConfig, "instruction") ?? undefined,
      isClosedBox: this.optionalBoolean(rawConfig, "isClosedBox"),
    };
  }

  async ensurePathaoToken(
    mode: CourierConfigMode,
    config: PathaoConfig,
  ): Promise<PathaoRuntime> {
    if (this.hasUsableToken(config)) {
      return {
        config,
        accessToken: config.accessToken,
      };
    }

    if (config.refreshToken) {
      try {
        return await this.refreshPathaoToken(mode, config);
      } catch {
        return this.issuePathaoToken(mode, config);
      }
    }

    return this.issuePathaoToken(mode, config);
  }

  async refreshPathaoToken(
    mode: CourierConfigMode,
    config: PathaoConfig,
  ): Promise<PathaoRuntime> {
    if (!config.refreshToken) {
      throw new BadRequestException("Pathao refreshToken is required");
    }

    const response = await this.pathaoRequest<PathaoTokenResponse>(
      mode,
      "/aladdin/api/v1/issue-token",
      {
        method: "POST",
        body: {
          client_id: config.clientId,
          client_secret: config.clientSecret,
          grant_type: "refresh_token",
          refresh_token: config.refreshToken,
        },
      },
    );

    return this.applyToken(config, response);
  }

  async issuePathaoToken(
    mode: CourierConfigMode,
    config: PathaoConfig,
  ): Promise<PathaoRuntime> {
    const response = await this.pathaoRequest<PathaoTokenResponse>(
      mode,
      "/aladdin/api/v1/issue-token",
      {
        method: "POST",
        body: {
          client_id: config.clientId,
          client_secret: config.clientSecret,
          grant_type: "password",
          username: config.username,
          password: config.password,
        },
      },
    );

    return this.applyToken(config, response);
  }

  async getPathaoStores(mode: CourierConfigMode, runtime: PathaoRuntime) {
    return this.pathaoRequest(mode, "/aladdin/api/v1/stores", {
      method: "GET",
      token: runtime.accessToken,
    });
  }

  async createPathaoStore(
    mode: CourierConfigMode,
    runtime: PathaoRuntime,
    params: PathaoCreateStoreParams,
  ) {
    return this.pathaoRequest(mode, "/aladdin/api/v1/stores", {
      method: "POST",
      token: runtime.accessToken,
      body: {
        name: params.name,
        contact_name: params.contactName,
        contact_number: params.contactNumber,
        secondary_contact: params.secondaryContact,
        otp_number: params.otpNumber,
        address: params.address,
        city_id: params.cityId,
        zone_id: params.zoneId,
        area_id: params.areaId,
      },
    });
  }

  async getPathaoCities(mode: CourierConfigMode, runtime: PathaoRuntime) {
    return this.pathaoRequest(mode, "/aladdin/api/v1/city-list", {
      method: "GET",
      token: runtime.accessToken,
    });
  }

  async getPathaoZones(
    mode: CourierConfigMode,
    runtime: PathaoRuntime,
    cityId: number,
  ) {
    return this.pathaoRequest(
      mode,
      `/aladdin/api/v1/cities/${cityId}/zone-list`,
      {
        method: "GET",
        token: runtime.accessToken,
      },
    );
  }

  async getPathaoAreas(
    mode: CourierConfigMode,
    runtime: PathaoRuntime,
    zoneId: number,
  ) {
    return this.pathaoRequest(
      mode,
      `/aladdin/api/v1/zones/${zoneId}/area-list`,
      {
        method: "GET",
        token: runtime.accessToken,
      },
    );
  }

  async calculatePathaoPrice(
    mode: CourierConfigMode,
    runtime: PathaoRuntime,
    params: PathaoPricePlanParams,
  ) {
    return await this.pathaoRequest(
      mode,
      "/aladdin/api/v1/merchant/price-plan",
      {
        method: "POST",
        token: runtime.accessToken,
        body: {
          store_id: runtime.config.storeId,
          item_type: params.itemType,
          delivery_type: params.deliveryType,
          item_weight: params.itemWeight,
          recipient_city: params.recipientCity,
          recipient_zone: params.recipientZone,
        },
      },
    );
  }

  async createPathaoOrder(
    mode: CourierConfigMode,
    runtime: PathaoRuntime,
    params: PathaoCreateOrderParams,
  ) {
    const deliveryType =
      params.deliveryType ?? runtime.config.deliveryType ?? 48;
    const itemType = params.itemType ?? runtime.config.itemType ?? 2;
    const itemWeight = params.itemWeight ?? runtime.config.itemWeight ?? 0.5;

    return this.pathaoRequest<PathaoResponse<Record<string, unknown>>>(
      mode,
      "/aladdin/api/v1/orders",
      {
        method: "POST",
        token: runtime.accessToken,
        body: {
          store_id: runtime.config.storeId,
          merchant_order_id: params.merchantOrderId ?? params.shipmentNo,
          recipient_name: params.recipientName,
          recipient_phone: params.recipientPhone,
          recipient_secondary_phone: params.recipientSecondaryPhone,
          recipient_address: params.recipientAddress,
          recipient_city: params.recipientCity,
          recipient_zone: params.recipientZone,
          recipient_area: params.recipientArea,
          delivery_type: deliveryType,
          item_type: itemType,
          special_instruction:
            params.specialInstruction ?? runtime.config.specialInstruction,
          item_quantity: params.itemQuantity,
          item_weight: itemWeight,
          item_description:
            params.itemDescription ?? runtime.config.itemDescription,
          amount_to_collect: Number(
            new Decimal(params.amountToCollect).toDecimalPlaces(2).toString(),
          ),
        },
      },
    );
  }

  async getPathaoOrderInfo(
    mode: CourierConfigMode,
    runtime: PathaoRuntime,
    consignmentId: string,
  ) {
    return this.pathaoRequest<PathaoResponse<Record<string, unknown>>>(
      mode,
      `/aladdin/api/v1/orders/${encodeURIComponent(consignmentId)}/info`,
      {
        method: "GET",
        token: runtime.accessToken,
      },
    );
  }

  async createSteadfastOrder(
    config: SteadfastConfig,
    params: CourierBookingParams,
  ) {
    return this.steadfastRequest<Record<string, unknown>>(
      config,
      "/create_order",
      {
        method: "POST",
        body: {
          invoice: params.orderNo,
          recipient_name: params.recipientName,
          recipient_phone: params.recipientPhone,
          alternative_phone: params.recipientSecondaryPhone,
          recipient_address: params.recipientAddress,
          cod_amount: Number(
            new Decimal(params.codAmount).toDecimalPlaces(2).toString(),
          ),
          note: params.specialInstruction ?? config.note,
          item_description: params.itemDescription ?? config.itemDescription,
          total_lot: params.itemQuantity,
          delivery_type:
            params.steadfast?.deliveryType ?? config.deliveryType ?? 0,
        },
      },
    );
  }

  async getSteadfastStatus(config: SteadfastConfig, trackingCode: string) {
    return this.steadfastRequest<Record<string, unknown>>(
      config,
      `/status_by_trackingcode/${encodeURIComponent(trackingCode)}`,
      { method: "GET" },
    );
  }

  async getSteadfastBalance(config: SteadfastConfig) {
    return this.steadfastRequest<Record<string, unknown>>(
      config,
      "/get_balance",
      {
        method: "GET",
      },
    );
  }

  async getSteadfastPoliceStations(config: SteadfastConfig) {
    return this.steadfastRequest<Record<string, unknown>>(
      config,
      "/police_stations",
      { method: "GET" },
    );
  }

  async createRedxParcel(config: RedxConfig, params: CourierBookingParams) {
    const deliveryArea =
      params.redx?.deliveryArea ?? config.deliveryArea ?? null;
    const deliveryAreaId =
      params.redx?.deliveryAreaId ?? config.deliveryAreaId ?? null;

    if (!deliveryArea || !deliveryAreaId) {
      throw new BadRequestException(
        "REDX deliveryArea and deliveryAreaId are required to create a parcel",
      );
    }

    return this.redxRequest<Record<string, unknown>>(config, "/parcel", {
      method: "POST",
      body: {
        customer_name: params.recipientName,
        customer_phone: params.recipientPhone,
        delivery_area: deliveryArea,
        delivery_area_id: deliveryAreaId,
        customer_address: params.recipientAddress,
        merchant_invoice_id: params.orderNo,
        cash_collection_amount: new Decimal(params.codAmount)
          .toDecimalPlaces(2)
          .toString(),
        parcel_weight:
          params.redx?.parcelWeight ?? params.itemWeight ?? config.parcelWeight,
        instruction: params.specialInstruction ?? config.instruction,
        value:
          params.redx?.parcelValue ??
          config.parcelValue ??
          Number(new Decimal(params.codAmount).toDecimalPlaces(2).toString()),
        is_closed_box: params.redx?.isClosedBox ?? config.isClosedBox,
        pickup_store_id: params.redx?.pickupStoreId ?? config.pickupStoreId,
      },
    });
  }

  async getRedxParcelDetails(config: RedxConfig, trackingId: string) {
    return this.redxRequest<Record<string, unknown>>(
      config,
      `/parcel/info/${encodeURIComponent(trackingId)}`,
      { method: "GET" },
    );
  }

  async trackRedxParcel(config: RedxConfig, trackingId: string) {
    return this.redxRequest<Record<string, unknown>>(
      config,
      `/parcel/track/${encodeURIComponent(trackingId)}`,
      { method: "GET" },
    );
  }

  async getRedxAreas(config: RedxConfig, postCode?: number) {
    const query = postCode ? `?post_code=${postCode}` : "";

    return this.redxRequest<Record<string, unknown>>(config, `/areas${query}`, {
      method: "GET",
    });
  }

  mapPathaoStatus(
    rawStatus: unknown,
    fallback: CourierShipmentStatus,
  ): CourierShipmentStatus {
    const status = this.stringValue(rawStatus)?.toLowerCase();

    switch (status) {
      case "pending":
        return CourierShipmentStatus.BOOKED;
      case "delivered":
        return CourierShipmentStatus.DELIVERED;
      case "returned":
        return CourierShipmentStatus.RETURNED;
      case "cancelled":
      case "canceled":
        return CourierShipmentStatus.CANCELLED;
      default:
        return fallback;
    }
  }

  mapSteadfastStatus(
    rawStatus: unknown,
    fallback: CourierShipmentStatus,
  ): CourierShipmentStatus {
    const status = this.stringValue(rawStatus)?.toLowerCase();

    switch (status) {
      case "pending":
      case "in_review":
        return CourierShipmentStatus.BOOKED;
      case "delivered":
      case "partial_delivered":
        return CourierShipmentStatus.DELIVERED;
      case "cancelled":
        return CourierShipmentStatus.CANCELLED;
      default:
        return fallback;
    }
  }

  mapRedxStatus(
    rawStatus: unknown,
    fallback: CourierShipmentStatus,
  ): CourierShipmentStatus {
    const status = this.stringValue(rawStatus)?.toLowerCase();

    switch (status) {
      case "pickup-pending":
        return CourierShipmentStatus.BOOKED;
      case "picked":
      case "picked-up":
        return CourierShipmentStatus.PICKED_UP;
      case "in-transit":
      case "in_transit":
        return CourierShipmentStatus.IN_TRANSIT;
      case "delivered":
        return CourierShipmentStatus.DELIVERED;
      case "cancelled":
      case "canceled":
        return CourierShipmentStatus.CANCELLED;
      default:
        return fallback;
    }
  }

  stringValue(value: unknown) {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === "string") {
      return value.trim() || null;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    return null;
  }

  private async pathaoRequest<T>(
    mode: CourierConfigMode,
    endpoint: string,
    options: {
      method: "GET" | "POST";
      token?: string;
      body?: Record<string, unknown>;
    },
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    if (options.token) {
      headers.Authorization = `Bearer ${options.token}`;
    }

    const response = await fetch(`${PATHAO_BASE_URLS[mode]}${endpoint}`, {
      method: options.method,
      headers,
      body:
        options.body === undefined
          ? undefined
          : JSON.stringify(this.omitUndefined(options.body)),
    });
    const text = await response.text();

    if (!response.ok) {
      throw new BadGatewayException(
        `Pathao request failed with HTTP ${response.status}: ${this.extractErrorMessage(text)}`,
      );
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new BadGatewayException("Pathao returned invalid JSON");
    }
  }

  private async steadfastRequest<T>(
    config: SteadfastConfig,
    endpoint: string,
    options: {
      method: "GET" | "POST";
      body?: Record<string, unknown>;
    },
  ): Promise<T> {
    return this.jsonRequest<T>(`https://portal.packzy.com/api/v1${endpoint}`, {
      method: options.method,
      headers: {
        "Api-Key": config.apiKey,
        "Secret-Key": config.secretKey,
      },
      body: options.body,
      errorPrefix: "Steadfast",
    });
  }

  private async redxRequest<T>(
    config: RedxConfig,
    endpoint: string,
    options: {
      method: "GET" | "POST" | "PATCH";
      body?: Record<string, unknown>;
    },
  ): Promise<T> {
    return this.jsonRequest<T>(`${config.baseUrl}/v1.0.0-beta${endpoint}`, {
      method: options.method,
      headers: {
        "API-ACCESS-TOKEN": `Bearer ${config.apiAccessToken}`,
      },
      body: options.body,
      errorPrefix: "REDX",
    });
  }

  private async jsonRequest<T>(
    url: string,
    options: {
      method: "GET" | "POST" | "PATCH";
      headers?: Record<string, string>;
      body?: Record<string, unknown>;
      errorPrefix: string;
    },
  ): Promise<T> {
    const response = await fetch(url, {
      method: options.method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...options.headers,
      },
      body:
        options.body === undefined
          ? undefined
          : JSON.stringify(this.omitUndefined(options.body)),
    });
    const text = await response.text();

    if (!response.ok) {
      throw new BadGatewayException(
        `${options.errorPrefix} request failed with HTTP ${response.status}: ${this.extractErrorMessage(text)}`,
      );
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new BadGatewayException(
        `${options.errorPrefix} returned invalid JSON`,
      );
    }
  }

  private applyToken(
    config: PathaoConfig,
    response: PathaoTokenResponse,
  ): PathaoRuntime {
    const accessToken = this.stringValue(response.access_token);

    if (!accessToken) {
      throw new BadGatewayException(
        "Pathao token response did not include access_token",
      );
    }

    const expiresIn =
      typeof response.expires_in === "number" && response.expires_in > 0
        ? response.expires_in
        : 0;
    const accessTokenExpiresAt =
      expiresIn > 0
        ? new Date(
            Date.now() + Math.max(expiresIn - 60, 0) * 1000,
          ).toISOString()
        : undefined;

    return {
      accessToken,
      config: {
        ...config,
        accessToken,
        refreshToken:
          this.stringValue(response.refresh_token) ?? config.refreshToken,
        accessTokenExpiresAt,
      },
    };
  }

  private hasUsableToken(
    config: PathaoConfig,
  ): config is PathaoConfig & { accessToken: string } {
    if (!config.accessToken || !config.accessTokenExpiresAt) {
      return false;
    }

    return new Date(config.accessTokenExpiresAt).getTime() > Date.now();
  }

  private requiredString(config: Record<string, unknown>, key: string) {
    const value = this.optionalString(config, key);

    if (!value) {
      throw new BadRequestException(`Pathao ${key} is required`);
    }

    return value;
  }

  private optionalString(config: Record<string, unknown>, key: string) {
    const value = config[key];

    return typeof value === "string" ? value.trim() || null : null;
  }

  private requiredInteger(config: Record<string, unknown>, key: string) {
    const value = this.numberValue(config[key]);

    if (value === null || !Number.isInteger(value) || value <= 0) {
      throw new BadRequestException(`Pathao ${key} must be a positive integer`);
    }

    return value;
  }

  private optionalEnum<T extends number>(
    config: Record<string, unknown>,
    key: string,
    allowed: readonly T[],
  ) {
    const value = this.numberValue(config[key]);

    if (value === null) {
      return undefined;
    }

    if (!allowed.includes(value as T)) {
      throw new BadRequestException(
        `Pathao ${key} must be one of: ${allowed.join(", ")}`,
      );
    }

    return value as T;
  }

  private optionalWeight(config: Record<string, unknown>, key: string) {
    const value = this.numberValue(config[key]);

    if (value === null) {
      return undefined;
    }

    if (value < 0.5 || value > 10) {
      throw new BadRequestException(
        "Pathao itemWeight must be between 0.5 and 10",
      );
    }

    return value;
  }

  private optionalPositiveInteger(
    config: Record<string, unknown>,
    key: string,
  ) {
    const value = this.numberValue(config[key]);

    if (value === null) {
      return undefined;
    }

    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestException(
        `Courier ${key} must be a positive integer`,
      );
    }

    return value;
  }

  private optionalPositiveNumber(config: Record<string, unknown>, key: string) {
    const value = this.numberValue(config[key]);

    if (value === null) {
      return undefined;
    }

    if (value <= 0) {
      throw new BadRequestException(`Courier ${key} must be greater than 0`);
    }

    return value;
  }

  private optionalBoolean(config: Record<string, unknown>, key: string) {
    const value = config[key];

    return typeof value === "boolean" ? value : undefined;
  }

  private numberValue(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim() !== "") {
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    }

    return null;
  }

  private omitUndefined(value: Record<string, unknown>) {
    return Object.entries(value).reduce<Record<string, unknown>>(
      (result, [key, entry]) => {
        if (entry !== undefined) {
          result[key] = entry;
        }

        return result;
      },
      {},
    );
  }

  private extractErrorMessage(text: string) {
    try {
      const payload = JSON.parse(text) as Record<string, unknown>;
      return (
        this.stringValue(payload.message) ??
        this.stringValue(payload.error) ??
        "Pathao rejected the request"
      );
    } catch {
      return text.trim() || "Pathao rejected the request";
    }
  }

  toJsonConfig(config: PathaoConfig): Record<string, unknown> {
    return { ...config };
  }
}
