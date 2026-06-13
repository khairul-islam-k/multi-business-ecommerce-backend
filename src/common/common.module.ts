import { Global, Module } from "@nestjs/common";

import { AppConfigService } from "./config/app-config.service";
import { RequestContextService } from "./request-context/request-context.service";

@Global()
@Module({
  providers: [AppConfigService, RequestContextService],
  exports: [AppConfigService, RequestContextService],
})
export class CommonModule {}
