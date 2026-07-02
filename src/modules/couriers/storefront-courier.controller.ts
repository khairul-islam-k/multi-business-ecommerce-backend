import { Body, Controller, Get, Headers, Param, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { CourierService } from "./courier.service";
import { StorefrontCourierQuoteDto } from "./dto/courier.dto";

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

  @Get("storefront/courier-delivery-zones")
  @ApiOperation({ summary: "Get enabled storefront courier delivery zones" })
  findStorefrontDeliveryZones(
    @Headers("host") host?: string,
    @Headers("x-forwarded-host") forwardedHost?: string,
  ) {
    return this.couriers.findStorefrontDeliveryZones(
      this.getRequestHost(host, forwardedHost),
    );
  }

  @Post("storefront/couriers/:configId/shipping-charge")
  @ApiOperation({ summary: "Calculate courier shipping charge" })
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

  private getRequestHost(host?: string, forwardedHost?: string) {
    return forwardedHost ?? host;
  }
}
