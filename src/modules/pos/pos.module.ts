import { Module } from "@nestjs/common";

import { BusinessModule } from "../business/business.module";
import { OrderModule } from "../orders/order.module";
import { PackageModule } from "../packages/package.module";
import { PermissionModule } from "../permissions/permission.module";
import { PosController } from "./pos.controller";

@Module({
  imports: [BusinessModule, PermissionModule, PackageModule, OrderModule],
  controllers: [PosController],
})
export class PosModule {}
