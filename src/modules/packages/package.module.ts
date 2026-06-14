import { forwardRef, Module } from "@nestjs/common";

import { PackageLimitGuard } from "./guards/package-limit.guard";
import { SubscriptionGuard } from "./guards/subscription.guard";
import { AdminPackageService } from "./admin/admin-package.service";
import { PackageLimitService } from "./package-limit.service";
import { PackageSubscriptionService } from "./package-subscription.service";
import { TenantPackageService } from "./tenant/tenant-package.service";
import { AdminPackageController } from "./admin/admin-package.controller";
import { TenantPackageController } from "./tenant/tenant-package.controller";
import { PermissionModule } from "../permissions/permission.module";

@Module({
  imports: [forwardRef(() => PermissionModule)],
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
    PackageSubscriptionService,
    PackageLimitService,
    SubscriptionGuard,
    PackageLimitGuard,
  ],
})
export class PackageModule {}
