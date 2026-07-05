import { forwardRef, Module } from "@nestjs/common";

import { AccessModule } from "../access/access.module";
import { PackageModule } from "../packages/package.module";
import { PermissionModule } from "../permissions/permission.module";
import { BusinessController } from "./business.controller";
import { BusinessService } from "./business.service";
import { BusinessGuard } from "./guards/business.guard";

@Module({
  imports: [AccessModule, forwardRef(() => PermissionModule), PackageModule],
  controllers: [BusinessController],
  providers: [BusinessService, BusinessGuard],
  exports: [BusinessService, BusinessGuard],
})
export class BusinessModule {}
