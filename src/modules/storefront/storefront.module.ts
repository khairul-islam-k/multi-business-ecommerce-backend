import { Module } from "@nestjs/common";

import { ProductCatalogModule } from "../product-catalog/product-catalog.module";
import { WebsiteModule } from "../website/website.module";
import { CustomerAuthModule } from "../customer-auth/customer-auth.module";
import { StorefrontCustomerController } from "./storefront-customer.controller";
import { StorefrontCustomerService } from "./storefront-customer.service";
import { StorefrontController } from "./storefront.controller";
import { StorefrontService } from "./storefront.service";

@Module({
  imports: [WebsiteModule, ProductCatalogModule, CustomerAuthModule],
  controllers: [StorefrontController, StorefrontCustomerController],
  providers: [StorefrontService, StorefrontCustomerService],
})
export class StorefrontModule {}
