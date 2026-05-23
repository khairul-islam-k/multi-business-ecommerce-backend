import { Module } from "@nestjs/common";

import { BusinessModule } from "../business/business.module";
import { InventoryModule } from "../inventory/inventory.module";
import { PackageModule } from "../packages/package.module";
import { PermissionModule } from "../permissions/permission.module";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";

@Module({
  imports: [BusinessModule, PermissionModule, PackageModule, InventoryModule],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
