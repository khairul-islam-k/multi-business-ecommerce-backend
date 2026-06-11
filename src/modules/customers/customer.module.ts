import { Module } from "@nestjs/common";

import { BusinessModule } from "../business/business.module";
import { PackageModule } from "../packages/package.module";
import { PermissionModule } from "../permissions/permission.module";
import { CustomerController } from "./customer.controller";
import { CustomerService } from "./customer.service";
import { CustomerAddressService } from "./application/customer-address.service";
import { CustomerOrderQueryService } from "./application/customer-order-query.service";
import { CustomerRepository } from "./infrastructure/customer.repository";

@Module({
  imports: [BusinessModule, PermissionModule, PackageModule],
  controllers: [CustomerController],
  providers: [
    CustomerService,
    CustomerAddressService,
    CustomerOrderQueryService,
    CustomerRepository,
  ],
  exports: [CustomerService],
})
export class CustomerModule {}
