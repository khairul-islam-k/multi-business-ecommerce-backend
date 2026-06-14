import { Module } from "@nestjs/common";

import { PosController } from "./pos.controller";
import { AccessModule } from "../access/access.module";
import { BusinessModule } from "../business/business.module";
import { OrderModule } from "../orders/order.module";
import { PackageModule } from "../packages/package.module";
import { PermissionModule } from "../permissions/permission.module";

@Module({
  imports: [
    AccessModule,
    BusinessModule,
    PermissionModule,
    PackageModule,
    OrderModule,
  ],
  controllers: [PosController],
})
export class PosModule {}
