import { Module } from "@nestjs/common";

import { PurchaseOrderReceivingService } from "./application/purchase-order-receiving.service";
import { PurchaseOrderService } from "./application/purchase-order.service";
import { PurchaseReturnService } from "./application/purchase-return.service";
import { SupplierCrudService } from "./application/supplier-crud.service";
import { SupplierInvoiceQueryService } from "./application/supplier-invoice-query.service";
import { SupplierProductService } from "./application/supplier-product.service";
import { PurchaseOrderRepository } from "./infrastructure/purchase-order.repository";
import { SupplierCodeRepository } from "./infrastructure/supplier-code.repository";
import { SupplierInvoiceRepository } from "./infrastructure/supplier-invoice.repository";
import { SupplierProductRepository } from "./infrastructure/supplier-product.repository";
import { SupplierRepository } from "./infrastructure/supplier.repository";
import { SupplierService } from "./supplier.service";
import { SupplierController } from "./supplier.controller";
import { AccessModule } from "../access/access.module";
import { BusinessModule } from "../business/business.module";
import { FinanceModule } from "../finance/finance.module";
import { InventoryModule } from "../inventory/inventory.module";
import { PackageModule } from "../packages/package.module";
import { PermissionModule } from "../permissions/permission.module";

@Module({
  imports: [
    AccessModule,
    BusinessModule,
    PermissionModule,
    PackageModule,
    InventoryModule,
    FinanceModule,
  ],
  controllers: [SupplierController],
  providers: [
    SupplierService,
    SupplierCrudService,
    SupplierProductService,
    PurchaseOrderService,
    PurchaseOrderReceivingService,
    SupplierInvoiceQueryService,
    PurchaseReturnService,
    SupplierRepository,
    SupplierProductRepository,
    PurchaseOrderRepository,
    SupplierInvoiceRepository,
    SupplierCodeRepository,
  ],
  exports: [SupplierService],
})
export class SupplierModule {}
