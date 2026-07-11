import { Module } from "@nestjs/common";

import { AccessModule } from "../access/access.module";
import { BusinessModule } from "../business/business.module";
import { PackageModule } from "../packages/package.module";
import { PermissionModule } from "../permissions/permission.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [AccessModule, BusinessModule, PermissionModule, PackageModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
