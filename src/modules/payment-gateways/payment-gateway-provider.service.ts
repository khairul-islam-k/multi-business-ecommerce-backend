import Decimal from "decimal.js";

import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from "@nestjs/common";

import { PaymentGatewayMode, PaymentGatewayProvider } from "@/database/schema";

import type { JsonValue } from "@/database/schema";

export type PaymentCustomer = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
};

export type GatewayCallbackUrls = {
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
  ipnUrl: string;
};

export type InitiateGatewayPaymentParams = {
  provider: PaymentGatewayProvider;
  mode: PaymentGatewayMode;
  config: Record<string, unknown>;
  paymentNo: string;
  amount: Decimal.Value;
  currency: string;
  orderNo: string;
  customer: PaymentCustomer;
  callbackUrls: GatewayCallbackUrls;
};

export type InitiatedGatewayPayment = {
  redirectUrl: string;
  sessionId?: string | null;
  transactionId?: string | null;
  rawResponse: JsonValue;
};

export type VerifyGatewayPaymentParams = {
  provider: PaymentGatewayProvider;
  mode: PaymentGatewayMode;
  config: Record<string, unknown>;
  paymentNo: string;
  amount: Decimal.Value;
  payload: Record<string, unknown>;
};

export type GatewayVerificationResult = {
  status: "PAID" | "FAILED" | "PENDING";
  transactionId?: string | null;
  eventId?: string | null;
  rawResponse: JsonValue;
};

@Injectable()
export class PaymentGatewayProviderService {
  async initiate(
    params: InitiateGatewayPaymentParams,
  ): Promise<InitiatedGatewayPayment> {
    switch (params.provider) {
      case PaymentGatewayProvider.SSLCOMMERZ:
        return this.initiateSslcommerz(params);
      case PaymentGatewayProvider.AAMARPAY:
        return this.initiateAamarpay(params);
      case PaymentGatewayProvider.SURJOPAY:
        return this.initiateSurjopay(params);
    }
  }

  async verify(
    params: VerifyGatewayPaymentParams,
  ): Promise<GatewayVerificationResult> {
    switch (params.provider) {
      case PaymentGatewayProvider.SSLCOMMERZ:
        return this.verifySslcommerz(params);
      case PaymentGatewayProvider.AAMARPAY:
        return this.verifyAamarpay(params);
      case PaymentGatewayProvider.SURJOPAY:
        return this.verifySurjopay(params);
    }
  }

  normalizeConfig(
    provider: PaymentGatewayProvider,
    rawConfig: Record<string, unknown>,
  ) {
    switch (provider) {
      case PaymentGatewayProvider.SSLCOMMERZ:
        return {
          storeId: this.requiredString(rawConfig, "storeId"),
          storePassword: this.requiredString(rawConfig, "storePassword"),
        };
      case PaymentGatewayProvider.AAMARPAY:
        return {
          storeId: this.requiredString(rawConfig, "storeId"),
          signatureKey: this.requiredString(rawConfig, "signatureKey"),
        };
      case PaymentGatewayProvider.SURJOPAY:
        return {
          endpoint: this.optionalString(rawConfig, "endpoint"),
          username: this.requiredString(rawConfig, "username"),
          password: this.requiredString(rawConfig, "password"),
          prefix: this.requiredString(rawConfig, "prefix"),
        };
    }
  }

  redactConfig(config: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(config).map(([key, value]) => [
        key,
        this.isSensitiveKey(key) ? "********" : value,
      ]),
    );
  }

  private async initiateSslcommerz(params: InitiateGatewayPaymentParams) {
    const storeId = this.requiredString(params.config, "storeId");
    const storePassword = this.requiredString(params.config, "storePassword");
    const body = new URLSearchParams({
      store_id: storeId,
      store_passwd: storePassword,
      total_amount: this.formatAmount(params.amount),
      currency: params.currency,
      tran_id: params.paymentNo,
      success_url: params.callbackUrls.successUrl,
      fail_url: params.callbackUrls.failUrl,
      cancel_url: params.callbackUrls.cancelUrl,
      ipn_url: params.callbackUrls.ipnUrl,
      cus_name: params.customer.name || "Customer",
      cus_email: params.customer.email || "customer@example.test",
      cus_add1: params.customer.address || "N/A",
      cus_city: params.customer.city || "N/A",
      cus_country: params.customer.country || "Bangladesh",
      cus_phone: params.customer.phone || "N/A",
      shipping_method: "NO",
      product_name: `Order ${params.orderNo}`,
      product_category: "general",
      product_profile: "general",
    });
    const response = await this.postForm(
      `${this.sslcommerzBaseUrl(params.mode)}/gwprocess/v4/api.php`,
      body,
    );
    const redirectUrl = this.stringValue(response.GatewayPageURL);

    if (response.status !== "SUCCESS" || !redirectUrl) {
      throw new BadGatewayException(
        this.stringValue(response.failedreason) ||
          "SSLCOMMERZ payment initiation failed",
      );
    }

    return {
      redirectUrl,
      sessionId: this.stringValue(response.sessionkey),
      rawResponse: response as JsonValue,
    };
  }

  private async initiateAamarpay(params: InitiateGatewayPaymentParams) {
    const storeId = this.requiredString(params.config, "storeId");
    const signatureKey = this.requiredString(params.config, "signatureKey");
    const response = await this.postJson(this.aamarpayPostUrl(params.mode), {
      store_id: storeId,
      signature_key: signatureKey,
      tran_id: params.paymentNo,
      amount: this.formatAmount(params.amount),
      currency: params.currency,
      desc: `Order ${params.orderNo}`,
      cus_name: params.customer.name || "Customer",
      cus_email: params.customer.email || "customer@example.test",
      cus_phone: params.customer.phone || "N/A",
      cus_add1: params.customer.address || "N/A",
      cus_city: params.customer.city || "N/A",
      cus_country: params.customer.country || "Bangladesh",
      success_url: params.callbackUrls.successUrl,
      fail_url: params.callbackUrls.failUrl,
      cancel_url: params.callbackUrls.cancelUrl,
      type: "json",
    });
    const redirectUrl = this.stringValue(response.payment_url);

    if (response.result !== "true" || !redirectUrl) {
      throw new BadGatewayException("aamarPay payment initiation failed");
    }

    return {
      redirectUrl,
      rawResponse: response as JsonValue,
    };
  }

  private async initiateSurjopay(params: InitiateGatewayPaymentParams) {
    const endpoint = this.optionalString(params.config, "endpoint");
    const username = this.requiredString(params.config, "username");
    const password = this.requiredString(params.config, "password");
    const prefix = this.requiredString(params.config, "prefix");
    const tokenResponse = await this.postJson(
      `${this.surjopayBaseUrl(params.mode, endpoint)}/api/get_token`,
      {
        username,
        password,
      },
    );
    const token = this.stringValue(tokenResponse.token);

    if (!token) {
      throw new BadGatewayException("surjoPay token request failed");
    }

    const response = await this.postJson(
      `${this.surjopayBaseUrl(params.mode, endpoint)}/api/secret-pay`,
      {
        prefix,
        token,
        return_url: params.callbackUrls.successUrl,
        cancel_url: params.callbackUrls.cancelUrl,
        store_id: this.stringValue(tokenResponse.store_id),
        amount: this.formatAmount(params.amount),
        order_id: params.paymentNo,
        currency: params.currency,
        customer_name: params.customer.name || "Customer",
        customer_address: params.customer.address || "N/A",
        customer_phone: params.customer.phone || "N/A",
        customer_city: params.customer.city || "N/A",
        customer_post_code: "N/A",
        client_ip: "127.0.0.1",
      },
      { Authorization: `Bearer ${token}` },
    );
    const redirectUrl = this.stringValue(response.checkout_url);

    if (!redirectUrl) {
      throw new BadGatewayException("surjoPay payment initiation failed");
    }

    return {
      redirectUrl,
      sessionId: this.stringValue(response.sp_order_id),
      rawResponse: response as JsonValue,
    };
  }

  private async verifySslcommerz(
    params: VerifyGatewayPaymentParams,
  ): Promise<GatewayVerificationResult> {
    const valId = this.stringValue(params.payload.val_id);

    if (!valId) {
      return {
        status: "FAILED" as const,
        rawResponse: params.payload as JsonValue,
      };
    }

    const storeId = this.requiredString(params.config, "storeId");
    const storePassword = this.requiredString(params.config, "storePassword");
    const url = new URL(
      `${this.sslcommerzBaseUrl(params.mode)}/validator/api/validationserverAPI.php`,
    );

    url.searchParams.set("val_id", valId);
    url.searchParams.set("store_id", storeId);
    url.searchParams.set("store_passwd", storePassword);
    url.searchParams.set("format", "json");

    const response = await this.getJson(url);
    const status = this.stringValue(response.status);
    const paid =
      ["VALID", "VALIDATED"].includes(status ?? "") &&
      this.stringValue(response.tran_id) === params.paymentNo &&
      this.amountMatches(response.amount, params.amount);

    return {
      status: paid ? "PAID" : "FAILED",
      transactionId: this.stringValue(response.bank_tran_id),
      eventId: valId,
      rawResponse: response as JsonValue,
    };
  }

  private async verifyAamarpay(
    params: VerifyGatewayPaymentParams,
  ): Promise<GatewayVerificationResult> {
    const requestId =
      this.stringValue(params.payload.mer_txnid) || params.paymentNo;
    const storeId = this.requiredString(params.config, "storeId");
    const signatureKey = this.requiredString(params.config, "signatureKey");
    const url = new URL(this.aamarpayCheckUrl(params.mode));

    url.searchParams.set("request_id", requestId);
    url.searchParams.set("store_id", storeId);
    url.searchParams.set("signature_key", signatureKey);
    url.searchParams.set("type", "json");

    const response = await this.getJson(url);
    const paid =
      this.stringValue(response.status_code) === "2" &&
      this.stringValue(response.mer_txnid) === params.paymentNo &&
      this.amountMatches(response.amount, params.amount);

    return {
      status: paid ? "PAID" : "FAILED",
      transactionId: this.stringValue(response.pg_txnid),
      eventId: this.stringValue(response.bank_trxid),
      rawResponse: response as JsonValue,
    };
  }

  private async verifySurjopay(
    params: VerifyGatewayPaymentParams,
  ): Promise<GatewayVerificationResult> {
    const endpoint = this.optionalString(params.config, "endpoint");
    const username = this.requiredString(params.config, "username");
    const password = this.requiredString(params.config, "password");
    const tokenResponse = await this.postJson(
      `${this.surjopayBaseUrl(params.mode, endpoint)}/api/get_token`,
      {
        username,
        password,
      },
    );
    const token = this.stringValue(tokenResponse.token);

    if (!token) {
      throw new BadGatewayException("surjoPay token request failed");
    }

    const response = await this.postJson(
      `${this.surjopayBaseUrl(params.mode, endpoint)}/api/verification`,
      {
        order_id:
          this.stringValue(params.payload.order_id) ||
          this.stringValue(params.payload.sp_order_id) ||
          params.paymentNo,
      },
      { Authorization: `Bearer ${token}` },
    );
    const rows = Array.isArray(response) ? response : [response];
    const row = (rows[0] ?? {}) as Record<string, unknown>;
    const successText = [
      this.stringValue(row.sp_message),
      this.stringValue(row.transaction_status),
      this.stringValue(row.bank_status),
    ]
      .join(" ")
      .toLowerCase();
    const paid =
      (this.stringValue(row.sp_code) === "1000" ||
        successText.includes("success")) &&
      this.amountMatches(row.amount, params.amount);

    return {
      status: paid ? "PAID" : "FAILED",
      transactionId:
        this.stringValue(row.bank_trx_id) || this.stringValue(row.invoice_no),
      eventId: this.stringValue(row.sp_order_id),
      rawResponse: response as JsonValue,
    };
  }

  private sslcommerzBaseUrl(mode: PaymentGatewayMode) {
    return mode === PaymentGatewayMode.SANDBOX
      ? "https://sandbox.sslcommerz.com"
      : "https://securepay.sslcommerz.com";
  }

  private aamarpayPostUrl(mode: PaymentGatewayMode) {
    return mode === PaymentGatewayMode.SANDBOX
      ? "https://sandbox.aamarpay.com/jsonpost.php"
      : "https://secure.aamarpay.com/jsonpost.php";
  }

  private aamarpayCheckUrl(mode: PaymentGatewayMode) {
    return mode === PaymentGatewayMode.SANDBOX
      ? "https://sandbox.aamarpay.com/api/v1/trxcheck/request.php"
      : "https://secure.aamarpay.com/api/v1/trxcheck/request.php";
  }

  private surjopayBaseUrl(mode: PaymentGatewayMode, endpoint?: string | null) {
    if (endpoint) {
      return endpoint.replace(/\/+$/, "");
    }

    return mode === PaymentGatewayMode.SANDBOX
      ? "https://sandbox.shurjopayment.com"
      : "https://engine.shurjopayment.com";
  }

  private async postForm(url: string, body: URLSearchParams) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    return this.parseJsonResponse(response);
  }

  private async postJson(
    url: string,
    body: Record<string, unknown>,
    headers: Record<string, string> = {},
  ) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    });

    return this.parseJsonResponse(response);
  }

  private async getJson(url: URL) {
    const response = await fetch(url);

    return this.parseJsonResponse(response);
  }

  private async parseJsonResponse(response: Response) {
    const text = await response.text();

    if (!response.ok) {
      throw new BadGatewayException(
        `Payment gateway request failed with HTTP ${response.status}`,
      );
    }

    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new BadGatewayException("Payment gateway returned invalid JSON");
    }
  }

  private requiredString(config: Record<string, unknown>, key: string) {
    const value = this.optionalString(config, key);

    if (!value) {
      throw new BadRequestException(`${key} is required`);
    }

    return value;
  }

  private optionalString(config: Record<string, unknown>, key: string) {
    const value = config[key];

    return typeof value === "string" ? value.trim() || null : null;
  }

  private stringValue(value: unknown) {
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

  private formatAmount(value: Decimal.Value) {
    return new Decimal(value).toDecimalPlaces(2).toFixed(2);
  }

  private amountMatches(actual: unknown, expected: Decimal.Value) {
    const actualValue = this.stringValue(actual);

    if (!actualValue) {
      return false;
    }

    return new Decimal(actualValue)
      .toDecimalPlaces(2)
      .equals(new Decimal(expected).toDecimalPlaces(2));
  }

  private isSensitiveKey(key: string) {
    return /(password|passwd|secret|signature|token|key)/i.test(key);
  }
}
