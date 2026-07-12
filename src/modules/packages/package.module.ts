import { forwardRef, Module } from "@nestjs/common";

import { PaymentGatewayCoreModule } from "../payment-gateways/payment-gateway-core.module";
import { PermissionModule } from "../permissions/permission.module";
import { AdminPackageController } from "./admin/admin-package.controller";
import { AdminPackageService } from "./admin/admin-package.service";
import { PackageLimitGuard } from "./guards/package-limit.guard";
import { SubscriptionGuard } from "./guards/subscription.guard";
import { PackageLimitService } from "./package-limit.service";
import { PackageSubscriptionService } from "./package-subscription.service";
import { TenantPackageController } from "./tenant/tenant-package.controller";
import { TenantPackageService } from "./tenant/tenant-package.service";

@Module({
  imports: [forwardRef(() => PermissionModule), PaymentGatewayCoreModule],
  controllers: [AdminPackageController, TenantPackageController],
  providers: [
    AdminPackageService,
    TenantPackageService,
    PackageSubscriptionService,
    PackageLimitService,
    SubscriptionGuard,
    PackageLimitGuard,
  ],
  exports: [
    TenantPackageService,
    PackageSubscriptionService,
    PackageLimitService,
    SubscriptionGuard,
    PackageLimitGuard,
  ],
})
export class PackageModule {}
