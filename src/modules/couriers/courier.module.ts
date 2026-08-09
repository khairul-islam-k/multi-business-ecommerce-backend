import { forwardRef, Module } from "@nestjs/common";

import { AccessModule } from "../access/access.module";
import { BusinessModule } from "../business/business.module";
import { FinanceModule } from "../finance/finance.module";
import { InventoryModule } from "../inventory/inventory.module";
import { OrderModule } from "../orders/order.module";
import { PackageModule } from "../packages/package.module";
import { PermissionModule } from "../permissions/permission.module";
import { WebsiteModule } from "../website/website.module";
import { CourierConfigEncryptionService } from "./courier-config-encryption.service";
import { CourierController } from "./courier.controller";
import { CourierProviderService } from "./courier-provider.service";
import { CourierService } from "./courier.service";
import { StorefrontCourierController } from "./storefront-courier.controller";

@Module({
  imports: [
    AccessModule,
    BusinessModule,
    FinanceModule,
    forwardRef(() => InventoryModule),
    forwardRef(() => OrderModule),
    PackageModule,
    PermissionModule,
    WebsiteModule,
  ],
  controllers: [CourierController, StorefrontCourierController],
  providers: [
    CourierService,
    CourierConfigEncryptionService,
    CourierProviderService,
  ],
  exports: [CourierService, CourierProviderService],
})
export class CourierModule {}
