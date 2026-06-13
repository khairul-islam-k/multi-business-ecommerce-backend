import { forwardRef, Module } from "@nestjs/common";

import { SubscriptionGuard } from "./guards/subscription.guard";
import { PackageLimitGuard } from "./guards/package-limit.guard";

import { PermissionModule } from "../permissions/permission.module";

import { PackageLimitService } from "./package-limit.service";
import { AdminPackageService } from "./admin/admin-package.service";
import { TenantPackageService } from "./tenant/tenant-package.service";
import { PackageSubscriptionService } from "./package-subscription.service";

import { AdminPackageController } from "./admin/admin-package.controller";
import { TenantPackageController } from "./tenant/tenant-package.controller";

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
