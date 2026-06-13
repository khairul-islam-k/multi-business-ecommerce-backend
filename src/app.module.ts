import { APP_FILTER } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { MiddlewareConsumer, Module } from "@nestjs/common";

import { AppService } from "./app.service";
import { AppController } from "./app.controller";

import { validateAppConfig } from "./common/config/app-config.schema";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { RequestLoggerMiddleware } from "./common/middlewares/request-logger.middleware";
import { RequestContextMiddleware } from "./common/request-context/request-context.middleware";

import { PosModule } from "./modules/pos/pos.module";
import { PrismaModule } from "./prisma/prisma.module";
import { CommonModule } from "./common/common.module";
import { AuthModule } from "./modules/auth/auth.module";
import { RoleModule } from "./modules/roles/role.module";
import { MediaModule } from "./modules/media/media.module";
import { OrderModule } from "./modules/orders/order.module";
import { TenantModule } from "./modules/tenants/tenant.module";
import { FinanceModule } from "./modules/finance/finance.module";
import { PackageModule } from "./modules/packages/package.module";
import { BusinessModule } from "./modules/business/business.module";
import { SupplierModule } from "./modules/suppliers/supplier.module";
import { CustomerModule } from "./modules/customers/customer.module";
import { EmployeeModule } from "./modules/employees/employee.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { PermissionModule } from "./modules/permissions/permission.module";
import { ProductCatalogModule } from "./modules/product-catalog/product-catalog.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateAppConfig,
    }),

    PrismaModule,
    CommonModule,

    AuthModule,
    TenantModule,
    PackageModule,
    BusinessModule,
    EmployeeModule,
    RoleModule,
    PermissionModule,
    MediaModule,
    ProductCatalogModule,
    InventoryModule,
    FinanceModule,
    SupplierModule,
    CustomerModule,
    OrderModule,
    PosModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestContextMiddleware, RequestLoggerMiddleware)
      .forRoutes("*path");
  }
}
