import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { CourierService } from "./courier.service";
import {
  RedxAreaQueryDto,
  RedxWebhookDto,
  StorefrontCourierQuoteDto,
} from "./dto/courier.dto";

@ApiTags("Storefront Couriers")
@Controller()
export class StorefrontCourierController {
  constructor(private readonly couriers: CourierService) {}

  @Get("storefront/couriers")
  @ApiOperation({ summary: "Get enabled storefront couriers" })
  findStorefrontCouriers(
    @Headers("host") host?: string,
    @Headers("x-forwarded-host") forwardedHost?: string,
  ) {
    return this.couriers.findStorefrontCouriers(
      this.getRequestHost(host, forwardedHost),
    );
  }

  @Get("storefront/couriers/:configId/redx/areas")
  @ApiOperation({ summary: "Get REDX delivery areas for storefront checkout" })
  findStorefrontRedxAreas(
    @Param("configId") configId: string,
    @Query() query: RedxAreaQueryDto,
    @Headers("host") host?: string,
    @Headers("x-forwarded-host") forwardedHost?: string,
  ) {
    return this.couriers.findStorefrontRedxAreas(
      this.getRequestHost(host, forwardedHost),
      configId,
      query,
    );
  }

  @Post("storefront/couriers/:configId/shipping-charge")
  @ApiOperation({ summary: "Calculate REDX storefront shipping charge" })
  calculateShippingCharge(
    @Param("configId") configId: string,
    @Body() dto: StorefrontCourierQuoteDto,
    @Headers("host") host?: string,
    @Headers("x-forwarded-host") forwardedHost?: string,
  ) {
    return this.couriers.calculateStorefrontShippingCharge(
      this.getRequestHost(host, forwardedHost),
      configId,
      dto,
    );
  }

  @Post("couriers/webhooks/redx")
  @ApiOperation({ summary: "Receive REDX shipment webhook" })
  receiveRedxWebhook(
    @Query("token") token: string,
    @Body() dto: RedxWebhookDto,
  ) {
    return this.couriers.receiveRedxWebhook(token, {
      ...dto,
    });
  }

  private getRequestHost(host?: string, forwardedHost?: string) {
    return forwardedHost ?? host;
  }
}
