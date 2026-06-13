import { Module } from "@nestjs/common";

import { BusinessModule } from "../business/business.module";
import { PackageModule } from "../packages/package.module";
import { PermissionModule } from "../permissions/permission.module";
import { ProductCatalogModule } from "../product-catalog/product-catalog.module";
import { StockMutationService } from "./application/stock-mutation.service";
import { StockReservationService } from "./application/stock-reservation.service";
import { StockAdjustmentController } from "./adjustments/stock-adjustment.controller";
import { StockAdjustmentService } from "./adjustments/stock-adjustment.service";
import { InventoryLookupService } from "./common/inventory-lookup.service";
import { StockController } from "./stocks/stock.controller";
import { StockService } from "./stocks/stock.service";
import { StockTransferController } from "./transfers/stock-transfer.controller";
import { StockTransferService } from "./transfers/stock-transfer.service";
import { WarehouseController } from "./warehouses/warehouse.controller";
import { WarehouseService } from "./warehouses/warehouse.service";

@Module({
  imports: [
    BusinessModule,
    PermissionModule,
    PackageModule,
    ProductCatalogModule,
  ],
  controllers: [
    WarehouseController,
    StockController,
    StockAdjustmentController,
    StockTransferController,
  ],
  providers: [
    InventoryLookupService,
    StockMutationService,
    StockReservationService,
    WarehouseService,
    StockService,
    StockAdjustmentService,
    StockTransferService,
  ],
  exports: [
    InventoryLookupService,
    StockMutationService,
    StockReservationService,
  ],
})
export class InventoryModule {}
