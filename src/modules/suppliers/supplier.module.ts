import { Module } from "@nestjs/common";

import { BusinessModule } from "../business/business.module";
import { FinanceModule } from "../finance/finance.module";
import { InventoryModule } from "../inventory/inventory.module";
import { PackageModule } from "../packages/package.module";
import { PermissionModule } from "../permissions/permission.module";
import { SupplierController } from "./supplier.controller";
import { SupplierService } from "./supplier.service";

@Module({
  imports: [
    BusinessModule,
    PermissionModule,
    PackageModule,
    InventoryModule,
    FinanceModule,
  ],
  controllers: [SupplierController],
  providers: [SupplierService],
  exports: [SupplierService],
})
export class SupplierModule {}
