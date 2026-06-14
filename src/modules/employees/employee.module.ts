import { Module } from "@nestjs/common";

import { EmployeeService } from "./employee.service";
import { EmployeeController } from "./employee.controller";
import { AccessModule } from "../access/access.module";
import { BusinessModule } from "../business/business.module";
import { PackageModule } from "../packages/package.module";
import { PermissionModule } from "../permissions/permission.module";

@Module({
  imports: [AccessModule, PermissionModule, BusinessModule, PackageModule],
  controllers: [EmployeeController],
  providers: [EmployeeService],
  exports: [EmployeeService],
})
export class EmployeeModule {}
