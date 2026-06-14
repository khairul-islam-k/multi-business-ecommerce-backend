import { forwardRef, Module } from "@nestjs/common";

import { PermissionGuard } from "./guards/permission.guard";
import { PermissionService } from "./permission.service";
import { PermissionController } from "./permission.controller";
import { AccessModule } from "../access/access.module";
import { BusinessModule } from "../business/business.module";
import { PackageModule } from "../packages/package.module";

@Module({
  imports: [
    AccessModule,
    forwardRef(() => BusinessModule),
    forwardRef(() => PackageModule),
  ],
  controllers: [PermissionController],
  providers: [PermissionService, PermissionGuard],
  exports: [PermissionService, PermissionGuard],
})
export class PermissionModule {}
