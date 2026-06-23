import { Module } from "@nestjs/common";

import { CustomerAuthModule } from "../customer-auth/customer-auth.module";
import { OrderModule } from "../orders/order.module";
import { ProductCatalogModule } from "../product-catalog/product-catalog.module";
import { WebsiteModule } from "../website/website.module";
import { StorefrontCustomerController } from "./storefront-customer.controller";
import { StorefrontCustomerService } from "./storefront-customer.service";
import { StorefrontController } from "./storefront.controller";
import { StorefrontService } from "./storefront.service";

@Module({
  imports: [
    WebsiteModule,
    ProductCatalogModule,
    CustomerAuthModule,
    OrderModule,
  ],
  controllers: [StorefrontController, StorefrontCustomerController],
  providers: [StorefrontService, StorefrontCustomerService],
})
export class StorefrontModule {}
