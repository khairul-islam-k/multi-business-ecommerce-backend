import { Module } from "@nestjs/common";

import { BusinessModule } from "../business/business.module";
import { InventoryModule } from "../inventory/inventory.module";
import { PackageModule } from "../packages/package.module";
import { PermissionModule } from "../permissions/permission.module";
import { SupplierController } from "./supplier.controller";
import { SupplierService } from "./supplier.service";

@Module({
  imports: [BusinessModule, PermissionModule, PackageModule, InventoryModule],
  controllers: [SupplierController],
  providers: [SupplierService],
  exports: [SupplierService],
})
export class SupplierModule {}
