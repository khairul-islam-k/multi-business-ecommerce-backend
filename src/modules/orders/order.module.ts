import { Module } from "@nestjs/common";

import { AccessModule } from "../access/access.module";
import { BusinessModule } from "../business/business.module";
import { FinanceModule } from "../finance/finance.module";
import { InventoryModule } from "../inventory/inventory.module";
import { PackageModule } from "../packages/package.module";
import { PermissionModule } from "../permissions/permission.module";
import { CreateOrderService } from "./application/create-order.service";
import { OrderPaymentService } from "./application/order-payment.service";
import { OrderQueryService } from "./application/order-query.service";
import { OrderReturnService } from "./application/order-return.service";
import { OrderStatusService } from "./application/order-status.service";
import { OrderCodeRepository } from "./infrastructure/order-code.repository";
import { OrderRepository } from "./infrastructure/order.repository";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";

@Module({
  imports: [
    AccessModule,
    BusinessModule,
    PermissionModule,
    PackageModule,
    InventoryModule,
    FinanceModule,
  ],
  controllers: [OrderController],
  providers: [
    OrderService,
    CreateOrderService,
    OrderQueryService,
    OrderPaymentService,
    OrderStatusService,
    OrderReturnService,
    OrderRepository,
    OrderCodeRepository,
  ],
  exports: [OrderService, OrderCodeRepository],
})
export class OrderModule {}
