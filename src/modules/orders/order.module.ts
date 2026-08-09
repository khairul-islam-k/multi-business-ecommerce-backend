import { forwardRef, Module } from "@nestjs/common";

import { AccessModule } from "../access/access.module";
import { BusinessModule } from "../business/business.module";
import { FinanceModule } from "../finance/finance.module";
import { InventoryModule } from "../inventory/inventory.module";
import { PackageModule } from "../packages/package.module";
import { PermissionModule } from "../permissions/permission.module";
import { CreateOrderService } from "./application/create-order.service";
import { InvoiceQueryService } from "./application/invoice-query.service";
import { OrderPaymentService } from "./application/order-payment.service";
import { OrderQueryService } from "./application/order-query.service";
import { OrderReturnService } from "./application/order-return.service";
import { OrderStatusService } from "./application/order-status.service";
import { OrderCodeRepository } from "./infrastructure/order-code.repository";
import { OrderRepository } from "./infrastructure/order.repository";
import { InvoiceController } from "./invoice.controller";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";
import { CourierModule } from "../couriers/courier.module";

@Module({
  imports: [
    AccessModule,
    BusinessModule,
    PermissionModule,
    PackageModule,
    InventoryModule,
    FinanceModule,
    forwardRef(() => CourierModule),
  ],
  controllers: [OrderController, InvoiceController],
  providers: [
    OrderService,
    CreateOrderService,
    InvoiceQueryService,
    OrderQueryService,
    OrderPaymentService,
    OrderStatusService,
    OrderReturnService,
    OrderRepository,
    OrderCodeRepository,
  ],
  exports: [OrderService, OrderCodeRepository, OrderPaymentService],
})
export class OrderModule {}
