import { PaymentGatewayProvider } from "@/database/schema";
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentCustomer } from "../customer-auth/decorators/current-customer.decorator";
import { CustomerAuthGuard } from "../customer-auth/guards/customer-auth.guard";
import {
  InitiateStorefrontPaymentDto,
  PaymentCallbackQueryDto,
} from "./dto/payment-gateway.dto";
import { PaymentGatewayService } from "./payment-gateway.service";

import type { CurrentCustomerPayload } from "../customer-auth/strategies/customer-jwt.strategy";
import type { Response } from "express";

@ApiTags("Storefront Payment Gateways")
@Controller()
export class StorefrontPaymentGatewayController {
  constructor(private readonly gateways: PaymentGatewayService) {}

  @Get("storefront/payment-gateways")
  @ApiOperation({ summary: "Get enabled storefront payment gateways" })
  findStorefrontGateways(
    @Headers("host") host?: string,
    @Headers("x-forwarded-host") forwardedHost?: string,
  ) {
    return this.gateways.findStorefrontGateways(
      this.getRequestHost(host, forwardedHost),
    );
  }

  @ApiBearerAuth()
  @UseGuards(CustomerAuthGuard)
  @Post("storefront/customer/orders/:orderId/payments/initiate")
  @ApiOperation({ summary: "Initiate storefront order payment" })
  initiateStorefrontPayment(
    @CurrentCustomer() customer: CurrentCustomerPayload,
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined,
    @Param("orderId", ParseUUIDPipe) orderId: string,
    @Body() dto: InitiateStorefrontPaymentDto,
  ) {
    return this.gateways.initiateStorefrontPayment(
      customer,
      this.getRequestHost(host, forwardedHost),
      orderId,
      dto,
    );
  }

  @Post("payment-gateways/callbacks/:provider/:paymentId/:eventType")
  @ApiOperation({ summary: "Handle payment gateway callback" })
  handlePostCallback(
    @Param("provider", new ParseEnumPipe(PaymentGatewayProvider))
    provider: PaymentGatewayProvider,
    @Param("paymentId", ParseUUIDPipe) paymentId: string,
    @Param("eventType") eventType: string,
    @Body() body: Record<string, unknown>,
    @Query() query: PaymentCallbackQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.redirectIfRequested(
      response,
      this.gateways.handleGatewayCallback(provider, paymentId, eventType, {
        ...query,
        ...body,
        __magic: "",
      }),
    );
  }

  @Get("payment-gateways/callbacks/:provider/:paymentId/:eventType")
  @ApiOperation({ summary: "Handle payment gateway callback redirect" })
  handleGetCallback(
    @Param("provider", new ParseEnumPipe(PaymentGatewayProvider))
    provider: PaymentGatewayProvider,
    @Param("paymentId", ParseUUIDPipe) paymentId: string,
    @Param("eventType") eventType: string,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.redirectIfRequested(
      response,
      this.gateways.handleGatewayCallback(provider, paymentId, eventType, {
        ...query,
        __magic: "",
      }),
    );
  }

  private getRequestHost(host?: string, forwardedHost?: string) {
    return forwardedHost ?? host;
  }

  private async redirectIfRequested(
    response: Response,
    resultPromise: ReturnType<PaymentGatewayService["handleGatewayCallback"]>,
  ) {
    const result = await resultPromise;
    const redirectUrl = this.getRedirectUrl(result.data);

    if (redirectUrl) {
      response.redirect(302, redirectUrl);
      return;
    }

    return result;
  }

  private getRedirectUrl(data: unknown) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return null;
    }

    const value = (data as Record<string, unknown>).redirectUrl;

    return typeof value === "string" && value.trim() ? value : null;
  }
}
