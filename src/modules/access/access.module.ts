import { Module } from "@nestjs/common";

import { BusinessAccessService } from "./services/business-access.service";

@Module({
  providers: [BusinessAccessService],
  exports: [BusinessAccessService],
})
export class AccessModule {}
