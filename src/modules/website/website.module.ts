import { Module } from "@nestjs/common";

import { AccessModule } from "../access/access.module";
import { BusinessModule } from "../business/business.module";
import { PackageModule } from "../packages/package.module";
import { PermissionModule } from "../permissions/permission.module";
import { WebsiteController } from "./website.controller";
import { WebsiteService } from "./website.service";

@Module({
  imports: [AccessModule, BusinessModule, PermissionModule, PackageModule],
  controllers: [WebsiteController],
  providers: [WebsiteService],
  exports: [WebsiteService],
})
export class WebsiteModule {}
