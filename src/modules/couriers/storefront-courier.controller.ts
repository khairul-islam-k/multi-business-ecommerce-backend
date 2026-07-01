import { Controller, Get, Headers } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { CourierService } from "./courier.service";

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

  private getRequestHost(host?: string, forwardedHost?: string) {
    return forwardedHost ?? host;
  }
}
