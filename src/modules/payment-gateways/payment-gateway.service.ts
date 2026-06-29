import Decimal from "decimal.js";
import { and, asc, count, desc, eq, ilike, isNull, or } from "drizzle-orm";

import {
  businessSetting,
  financeAccount,
  FinanceAccountStatus,
  FinanceSourceType,
  JsonValue,
  order,
  orderPayment,
  OrderPaymentMethod,
  OrderPaymentStatus,
  PaymentGateway,
  paymentGateway,
  PaymentGatewayConfig,
  paymentGatewayConfig,
  PaymentGatewayConfigStatus,
  PaymentGatewayProvider,
  PaymentGatewayStatus,
  paymentWebhookEvent,
  PaymentWebhookStatus,
} from "@/database/schema";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { AppConfigService } from "../../common/config/app-config.service";
import { isUniqueConstraintError } from "../../common/database/db-error.util";
import {
  apiResponse,
  paginatedResponse,
} from "../../common/utils/api-response.util";
import {
  DatabaseService,
  DatabaseTransaction,
} from "../../database/database.service";
import { FinanceLedgerService } from "../finance/common/finance-ledger.service";
import { OrderPaymentService } from "../orders/application/order-payment.service";
import { OrderCodeRepository } from "../orders/infrastructure/order-code.repository";
import { WebsiteService } from "../website/website.service";
import {
  CreatePaymentGatewayConfigDto,
  InitiateStorefrontPaymentDto,
  QueryPaymentGatewayConfigDto,
  QueryPaymentGatewayDto,
  SeedPaymentGatewayDto,
  UpdatePaymentGatewayConfigDto,
} from "./dto/payment-gateway.dto";
import { PaymentConfigEncryptionService } from "./payment-config-encryption.service";
import { PaymentGatewayProviderService } from "./payment-gateway-provider.service";

import type { CurrentCustomerPayload } from "../customer-auth/strategies/customer-jwt.strategy";
import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";

type PaymentConfigWithGateway = {
  config: PaymentGatewayConfig;
  gateway: PaymentGateway;
};

@Injectable()
export class PaymentGatewayService {
  constructor(
    private readonly database: DatabaseService,
    private readonly appConfig: AppConfigService,
    private readonly encryption: PaymentConfigEncryptionService,
    private readonly providers: PaymentGatewayProviderService,
    private readonly websites: WebsiteService,
    private readonly orderCodes: OrderCodeRepository,
    private readonly orderPayments: OrderPaymentService,
    private readonly finance: FinanceLedgerService,
  ) {}

  private get db() {
    return this.database.db;
  }

  async seedGateways(items: SeedPaymentGatewayDto[]) {
    const rows = await this.db.transaction(async (tx) => {
      const seeded: PaymentGateway[] = [];

      for (const item of items) {
        const [row] = await tx
          .insert(paymentGateway)
          .values({
            code: item.code,
            name: item.name.trim(),
            description: item.description?.trim() || null,
            status: item.status ?? PaymentGatewayStatus.ACTIVE,
            sortOrder: item.sortOrder ?? 0,
          })
          .onConflictDoUpdate({
            target: paymentGateway.code,
            set: {
              name: item.name.trim(),
              description: item.description?.trim() || null,
              status: item.status ?? PaymentGatewayStatus.ACTIVE,
              sortOrder: item.sortOrder ?? 0,
            },
          })
          .returning();

        seeded.push(row);
      }

      return seeded;
    });

    return apiResponse(rows, "Payment gateways seeded successfully");
  }

  async findGateways(query: QueryPaymentGatewayDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();
    const where = and(
      query.status ? eq(paymentGateway.status, query.status) : undefined,
      search
        ? or(
            ilike(paymentGateway.name, `%${search}%`),
            ilike(paymentGateway.description, `%${search}%`),
          )
        : undefined,
    );
    const [items, total] = await Promise.all([
      this.db
        .select()
        .from(paymentGateway)
        .where(where)
        .orderBy(asc(paymentGateway.sortOrder), asc(paymentGateway.name))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(paymentGateway)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(
      items,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Payment gateway providers were loaded successfully. The response includes the requested page of seeded providers and pagination metadata for browsing more results.",
    );
  }

  async findConfigs(businessId: string, query: QueryPaymentGatewayConfigDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();
    const where = and(
      eq(paymentGatewayConfig.businessId, businessId),
      isNull(paymentGatewayConfig.deletedAt),
      query.mode ? eq(paymentGatewayConfig.mode, query.mode) : undefined,
      query.status ? eq(paymentGatewayConfig.status, query.status) : undefined,
      query.provider ? eq(paymentGateway.code, query.provider) : undefined,
      search
        ? or(
            ilike(paymentGateway.name, `%${search}%`),
            ilike(paymentGateway.description, `%${search}%`),
          )
        : undefined,
    );
    const [rows, total] = await Promise.all([
      this.db
        .select({ config: paymentGatewayConfig, gateway: paymentGateway })
        .from(paymentGatewayConfig)
        .innerJoin(
          paymentGateway,
          eq(paymentGateway.id, paymentGatewayConfig.gatewayId),
        )
        .where(where)
        .orderBy(desc(paymentGatewayConfig.createdAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(paymentGatewayConfig)
        .innerJoin(
          paymentGateway,
          eq(paymentGateway.id, paymentGatewayConfig.gatewayId),
        )
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(
      rows.map((row) => this.toConfigResponse(row.config, row.gateway)),
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Payment gateway configurations were loaded successfully. The response includes the requested page of business gateway configurations and pagination metadata for browsing more results.",
    );
  }

  async createConfig(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreatePaymentGatewayConfigDto,
  ) {
    const gateway = await this.getGatewayByProviderOrThrow(dto.provider);
    await this.assertActiveFinanceAccount(businessId, dto.financeAccountId);
    const normalizedConfig = this.providers.normalizeConfig(
      dto.provider,
      dto.configData,
    );

    try {
      const [created] = await this.db
        .insert(paymentGatewayConfig)
        .values({
          businessId,
          gatewayId: gateway.id,
          financeAccountId: dto.financeAccountId,
          configData: this.encryption.encrypt(normalizedConfig),
          mode: dto.mode,
          status: dto.status ?? PaymentGatewayConfigStatus.INACTIVE,
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
        })
        .returning();

      return apiResponse(
        this.toConfigResponse(created, gateway),
        "Payment gateway configured successfully",
      );
    } catch (error) {
      this.handleUniqueError(error);
    }
  }

  async updateConfig(
    currentUser: CurrentUserPayload,
    businessId: string,
    configId: string,
    dto: UpdatePaymentGatewayConfigDto,
  ) {
    const existing = await this.getConfigWithGatewayOrThrow(
      businessId,
      configId,
    );
    const provider = dto.provider ?? existing.gateway.code;

    if (dto.provider && dto.provider !== existing.gateway.code) {
      throw new BadRequestException(
        "Payment gateway provider cannot be changed for an existing config",
      );
    }

    if (dto.financeAccountId) {
      await this.assertActiveFinanceAccount(businessId, dto.financeAccountId);
    }

    const nextConfig =
      dto.configData !== undefined
        ? this.providers.normalizeConfig(provider, dto.configData)
        : this.encryption.decrypt(existing.config.configData);

    try {
      const [updated] = await this.db
        .update(paymentGatewayConfig)
        .set({
          ...(dto.financeAccountId !== undefined && {
            financeAccountId: dto.financeAccountId,
          }),
          ...(dto.mode !== undefined && { mode: dto.mode }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.configData !== undefined && {
            configData: this.encryption.encrypt(nextConfig),
          }),
          updatedBy: currentUser.id,
        })
        .where(eq(paymentGatewayConfig.id, configId))
        .returning();

      return apiResponse(
        this.toConfigResponse(updated, existing.gateway),
        "Payment gateway configuration updated successfully",
      );
    } catch (error) {
      this.handleUniqueError(error);
    }
  }

  async removeConfig(
    currentUser: CurrentUserPayload,
    businessId: string,
    configId: string,
  ) {
    await this.getConfigWithGatewayOrThrow(businessId, configId);

    await this.db
      .update(paymentGatewayConfig)
      .set({
        status: PaymentGatewayConfigStatus.INACTIVE,
        deletedAt: new Date(),
        deletedBy: currentUser.id,
        updatedBy: currentUser.id,
      })
      .where(eq(paymentGatewayConfig.id, configId));

    return apiResponse(null, "Payment gateway configuration deleted");
  }

  async findStorefrontGateways(host?: string) {
    const storefront = await this.websites.findPublishedByHostOrThrow(host);
    const settings = await this.getBusinessPaymentSettings(
      storefront.businessId,
    );

    if (!settings.onlinePaymentEnabled) {
      return apiResponse([]);
    }

    const rows = await this.db
      .select({ config: paymentGatewayConfig, gateway: paymentGateway })
      .from(paymentGatewayConfig)
      .innerJoin(
        paymentGateway,
        eq(paymentGateway.id, paymentGatewayConfig.gatewayId),
      )
      .where(
        and(
          eq(paymentGatewayConfig.businessId, storefront.businessId),
          eq(paymentGatewayConfig.status, PaymentGatewayConfigStatus.ACTIVE),
          eq(paymentGateway.status, PaymentGatewayStatus.ACTIVE),
          isNull(paymentGatewayConfig.deletedAt),
        ),
      )
      .orderBy(asc(paymentGateway.sortOrder), asc(paymentGateway.name));

    return apiResponse(
      rows.map((row) => ({
        id: row.config.id,
        gatewayId: row.gateway.id,
        code: row.gateway.code,
        name: row.gateway.name,
        description: row.gateway.description,
        mode: row.config.mode,
      })),
    );
  }

  async initiateStorefrontPayment(
    currentCustomer: CurrentCustomerPayload,
    host: string | undefined,
    orderId: string,
    dto: InitiateStorefrontPaymentDto,
  ) {
    const storefront = await this.websites.findPublishedByHostOrThrow(host);

    if (
      storefront.id !== currentCustomer.websiteId ||
      storefront.businessId !== currentCustomer.businessId
    ) {
      throw new NotFoundException(
        "Order could not be found. It may not exist, may have been deleted, or may not belong to the current business or customer account.",
      );
    }

    const settings = await this.getBusinessPaymentSettings(
      currentCustomer.businessId,
    );

    if (!settings.onlinePaymentEnabled) {
      throw new BadRequestException(
        "Online payment is not enabled for this storefront",
      );
    }

    const row = await this.getPayableCustomerOrderOrThrow(
      currentCustomer,
      orderId,
    );
    const amount = new Decimal(row.totalAmount).minus(row.paidAmount);

    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException("Order has no payable amount remaining");
    }

    const config = await this.getActiveConfigByProviderOrThrow(
      currentCustomer.businessId,
      dto.provider,
    );
    const paymentNo = await this.orderCodes.generateUniquePaymentNo(
      currentCustomer.businessId,
    );

    const [createdPayment] = await this.db
      .insert(orderPayment)
      .values({
        businessId: currentCustomer.businessId,
        orderId: row.id,
        financeAccountId: config.config.financeAccountId,
        gatewayId: config.gateway.id,
        gatewayConfigId: config.config.id,
        paymentNo,
        amount,
        paymentMethod: OrderPaymentMethod.OTHER,
        paymentStatus: OrderPaymentStatus.PENDING,
        transactionReference: paymentNo,
        gatewayPayload: {
          requestedRedirects: {
            successRedirectUrl: dto.successRedirectUrl ?? null,
            failRedirectUrl: dto.failRedirectUrl ?? null,
            cancelRedirectUrl: dto.cancelRedirectUrl ?? null,
          },
        } as JsonValue,
      })
      .returning();

    const initiated = await this.providers.initiate({
      provider: config.gateway.code,
      mode: config.config.mode,
      config: this.encryption.decrypt(config.config.configData),
      paymentNo,
      amount,
      currency: "BDT",
      orderNo: row.orderNo,
      customer: {
        name: row.customerName,
        email: row.customerEmail,
        phone: row.customerPhone,
        ...this.getAddressParts(row.shippingAddressSnapshot),
      },
      callbackUrls: {
        successUrl: `${dto.successRedirectUrl}?provider=${config.gateway.code}&paymentId=${createdPayment.id}`,
        cancelUrl: `${dto.cancelRedirectUrl}?provider=${config.gateway.code}&paymentId=${createdPayment.id}`,
        failUrl: `${dto.failRedirectUrl}?provider=${config.gateway.code}&paymentId=${createdPayment.id}`,
        ipnUrl: `${this.appConfig.publicApiUrl}/payment-gateways/callbacks/${config.gateway.code}/${createdPayment.id}/ipn`,
      },
    });

    const [updatedPayment] = await this.db
      .update(orderPayment)
      .set({
        gatewaySessionId: initiated.sessionId ?? null,
        gatewayTransactionId: initiated.transactionId ?? null,
        gatewayPayload: {
          initiation: initiated.rawResponse,
          requestedRedirects: {
            successRedirectUrl: dto.successRedirectUrl ?? null,
            failRedirectUrl: dto.failRedirectUrl ?? null,
            cancelRedirectUrl: dto.cancelRedirectUrl ?? null,
          },
        },
      })
      .where(eq(orderPayment.id, createdPayment.id))
      .returning();

    await this.db.transaction((tx) =>
      this.orderPayments.refreshOrderPaymentState(
        tx,
        currentCustomer.businessId,
        row.id,
      ),
    );

    return apiResponse(
      {
        payment: updatedPayment,
        redirectUrl: initiated.redirectUrl,
      },
      "Payment initiated successfully",
    );
  }

  async handleGatewayCallback(
    provider: PaymentGatewayProvider,
    paymentId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    const payment = await this.getGatewayPaymentOrThrow(provider, paymentId);
    const config = await this.getConfigWithGatewayOrThrow(
      payment.businessId,
      payment.gatewayConfigId ?? "",
    );

    if (payment.paymentStatus === OrderPaymentStatus.PAID) {
      return apiResponse(payment, "Payment already processed");
    }

    const [event] = await this.db
      .insert(paymentWebhookEvent)
      .values({
        businessId: payment.businessId,
        gatewayId: config.gateway.id,
        orderPaymentId: payment.id,
        eventType,
        eventId: this.extractEventId(provider, payload),
        payload: payload as JsonValue,
        status: PaymentWebhookStatus.PENDING,
      })
      .returning();

    const verification = await this.providers.verify({
      provider,
      mode: config.config.mode,
      config: this.encryption.decrypt(config.config.configData),
      paymentNo: payment.paymentNo,
      amount: payment.amount,
      payload,
    });

    const updatedPayment = await this.db.transaction(async (tx) => {
      if (verification.status === "PAID") {
        await this.markPaymentPaid(tx, payment, verification);
      } else if (verification.status === "FAILED") {
        await tx
          .update(orderPayment)
          .set({
            paymentStatus: OrderPaymentStatus.FAILED,
            gatewayEventId: verification.eventId ?? event.id,
            gatewayPayload: verification.rawResponse,
          })
          .where(eq(orderPayment.id, payment.id));
      }

      await tx
        .update(paymentWebhookEvent)
        .set({
          status:
            verification.status === "PENDING"
              ? PaymentWebhookStatus.IGNORED
              : PaymentWebhookStatus.PROCESSED,
          processedAt: new Date(),
        })
        .where(eq(paymentWebhookEvent.id, event.id));

      await this.orderPayments.refreshOrderPaymentState(
        tx,
        payment.businessId,
        payment.orderId,
      );

      return tx
        .select()
        .from(orderPayment)
        .where(eq(orderPayment.id, payment.id))
        .limit(1)
        .then(([row]) => row);
    });

    return apiResponse(updatedPayment, "Payment callback processed");
  }

  private async markPaymentPaid(
    tx: DatabaseTransaction,
    payment: typeof orderPayment.$inferSelect,
    verification: Awaited<ReturnType<PaymentGatewayProviderService["verify"]>>,
  ) {
    await tx
      .update(orderPayment)
      .set({
        paymentStatus: OrderPaymentStatus.PAID,
        gatewayTransactionId: verification.transactionId ?? null,
        gatewayEventId: verification.eventId ?? null,
        gatewayPayload: verification.rawResponse,
        paidAt: new Date(),
      })
      .where(eq(orderPayment.id, payment.id));

    if (!payment.financeAccountId) {
      throw new BadRequestException("Payment finance account is missing");
    }

    await this.finance.creditAccount(tx, {
      businessId: payment.businessId,
      accountId: payment.financeAccountId,
      amount: payment.amount,
      referenceType: FinanceSourceType.ORDER,
      referenceId: payment.orderId,
      note: `Gateway payment ${payment.paymentNo}`,
      createdBy: payment.createdBy ?? undefined,
    });
  }

  private async getGatewayByProviderOrThrow(provider: PaymentGatewayProvider) {
    const [gateway] = await this.db
      .select()
      .from(paymentGateway)
      .where(eq(paymentGateway.code, provider))
      .limit(1);

    if (!gateway) {
      throw new NotFoundException("Payment gateway is not seeded");
    }

    return gateway;
  }

  private async getConfigWithGatewayOrThrow(
    businessId: string,
    configId: string,
  ): Promise<PaymentConfigWithGateway> {
    const [row] = await this.db
      .select({ config: paymentGatewayConfig, gateway: paymentGateway })
      .from(paymentGatewayConfig)
      .innerJoin(
        paymentGateway,
        eq(paymentGateway.id, paymentGatewayConfig.gatewayId),
      )
      .where(
        and(
          eq(paymentGatewayConfig.id, configId),
          eq(paymentGatewayConfig.businessId, businessId),
          isNull(paymentGatewayConfig.deletedAt),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException("Payment gateway configuration not found");
    }

    return row;
  }

  private async getActiveConfigByProviderOrThrow(
    businessId: string,
    provider: PaymentGatewayProvider,
  ) {
    const [row] = await this.db
      .select({ config: paymentGatewayConfig, gateway: paymentGateway })
      .from(paymentGatewayConfig)
      .innerJoin(
        paymentGateway,
        eq(paymentGateway.id, paymentGatewayConfig.gatewayId),
      )
      .where(
        and(
          eq(paymentGatewayConfig.businessId, businessId),
          eq(paymentGatewayConfig.status, PaymentGatewayConfigStatus.ACTIVE),
          eq(paymentGateway.status, PaymentGatewayStatus.ACTIVE),
          eq(paymentGateway.code, provider),
          isNull(paymentGatewayConfig.deletedAt),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException("Active payment gateway not found");
    }

    return row;
  }

  private async assertActiveFinanceAccount(
    businessId: string,
    accountId: string,
  ) {
    const [account] = await this.db
      .select({ id: financeAccount.id })
      .from(financeAccount)
      .where(
        and(
          eq(financeAccount.id, accountId),
          eq(financeAccount.businessId, businessId),
          eq(financeAccount.status, FinanceAccountStatus.ACTIVE),
          isNull(financeAccount.deletedAt),
        ),
      )
      .limit(1);

    if (!account) {
      throw new NotFoundException(
        "Payment gateway finance account must be an active account for this business",
      );
    }
  }

  private async getBusinessPaymentSettings(businessId: string) {
    const [settings] = await this.db
      .select({
        codEnabled: businessSetting.codEnabled,
        onlinePaymentEnabled: businessSetting.onlinePaymentEnabled,
      })
      .from(businessSetting)
      .where(eq(businessSetting.businessId, businessId))
      .limit(1);

    return {
      codEnabled: settings?.codEnabled ?? false,
      onlinePaymentEnabled: settings?.onlinePaymentEnabled ?? false,
    };
  }

  private async getPayableCustomerOrderOrThrow(
    currentCustomer: CurrentCustomerPayload,
    orderId: string,
  ) {
    const [row] = await this.db
      .select()
      .from(order)
      .where(
        and(
          eq(order.id, orderId),
          eq(order.businessId, currentCustomer.businessId),
          eq(order.customerId, currentCustomer.customerId),
          isNull(order.deletedAt),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException(
        "Order could not be found. It may not exist, may have been deleted, or may not belong to the current business or customer account.",
      );
    }

    return row;
  }

  private async getGatewayPaymentOrThrow(
    provider: PaymentGatewayProvider,
    paymentId: string,
  ) {
    const [row] = await this.db
      .select({ payment: orderPayment })
      .from(orderPayment)
      .innerJoin(paymentGateway, eq(paymentGateway.id, orderPayment.gatewayId))
      .where(
        and(eq(orderPayment.id, paymentId), eq(paymentGateway.code, provider)),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException("Gateway payment not found");
    }

    return row.payment;
  }

  private toConfigResponse(
    config: PaymentGatewayConfig,
    gateway: typeof paymentGateway.$inferSelect,
  ) {
    const decrypted = this.encryption.decrypt(config.configData);

    return {
      ...config,
      configData: this.providers.redactConfig(decrypted),
      gateway,
    };
  }

  private getAddressParts(value: JsonValue | null) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return {
      address: typeof value.address === "string" ? value.address : undefined,
      city: typeof value.city === "string" ? value.city : undefined,
      country: typeof value.country === "string" ? value.country : undefined,
    };
  }

  private extractEventId(
    provider: PaymentGatewayProvider,
    payload: Record<string, unknown>,
  ) {
    switch (provider) {
      case PaymentGatewayProvider.SSLCOMMERZ:
        return (
          this.stringValue(payload.val_id) ??
          this.stringValue(payload.bank_tran_id)
        );
      case PaymentGatewayProvider.AAMARPAY:
        return (
          this.stringValue(payload.pg_txnid) ??
          this.stringValue(payload.bank_txn)
        );
      case PaymentGatewayProvider.SURJOPAY:
        return (
          this.stringValue(payload.sp_order_id) ??
          this.stringValue(payload.order_id)
        );
    }
  }

  private stringValue(value: unknown) {
    if (typeof value === "string") {
      return value.trim() || null;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    return null;
  }

  private handleUniqueError(error: unknown): never {
    if (isUniqueConstraintError(error)) {
      throw new ConflictException(
        "A payment gateway configuration already exists for this provider",
      );
    }

    throw error;
  }
}
