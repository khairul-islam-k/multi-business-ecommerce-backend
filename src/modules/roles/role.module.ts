import { Module } from "@nestjs/common";

import { AccessModule } from "../access/access.module";
import { BusinessModule } from "../business/business.module";
import { PackageModule } from "../packages/package.module";
import { PermissionModule } from "../permissions/permission.module";
import { RoleController } from "./role.controller";
import { RoleService } from "./role.service";

@Module({
  imports: [AccessModule, BusinessModule, PermissionModule, PackageModule],
  controllers: [RoleController],
  providers: [RoleService],
  exports: [RoleService],
})
export class RoleModule {}
