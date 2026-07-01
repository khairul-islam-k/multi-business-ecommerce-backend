import { Module } from "@nestjs/common";

import { AccessModule } from "../access/access.module";
import { BusinessModule } from "../business/business.module";
import { PackageModule } from "../packages/package.module";
import { PermissionModule } from "../permissions/permission.module";
import { WebsiteModule } from "../website/website.module";
import { CourierConfigEncryptionService } from "./courier-config-encryption.service";
import { CourierController } from "./courier.controller";
import { CourierService } from "./courier.service";
import { StorefrontCourierController } from "./storefront-courier.controller";

@Module({
  imports: [
    AccessModule,
    BusinessModule,
    PackageModule,
    PermissionModule,
    WebsiteModule,
  ],
  controllers: [CourierController, StorefrontCourierController],
  providers: [CourierService, CourierConfigEncryptionService],
  exports: [CourierService],
})
export class CourierModule {}
