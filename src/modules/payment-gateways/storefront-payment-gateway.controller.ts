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
  ) {
    return this.gateways.handleGatewayCallback(provider, paymentId, eventType, {
      ...query,
      ...body,
      __magic: "",
    });
  }

  @Get("payment-gateways/callbacks/:provider/:paymentId/:eventType")
  @ApiOperation({ summary: "Handle payment gateway callback redirect" })
  handleGetCallback(
    @Param("provider", new ParseEnumPipe(PaymentGatewayProvider))
    provider: PaymentGatewayProvider,
    @Param("paymentId", ParseUUIDPipe) paymentId: string,
    @Param("eventType") eventType: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.gateways.handleGatewayCallback(provider, paymentId, eventType, {
      ...query,
      __magic: "",
    });
  }

  private getRequestHost(host?: string, forwardedHost?: string) {
    return forwardedHost ?? host;
  }
}
