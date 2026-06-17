import { Module } from "@nestjs/common";

import { ProductCatalogModule } from "../product-catalog/product-catalog.module";
import { WebsiteModule } from "../website/website.module";
import { StorefrontController } from "./storefront.controller";
import { StorefrontService } from "./storefront.service";

@Module({
  imports: [WebsiteModule, ProductCatalogModule],
  controllers: [StorefrontController],
  providers: [StorefrontService],
})
export class StorefrontModule {}
