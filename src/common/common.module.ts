import { Global, Module } from "@nestjs/common";

import { AppConfigService } from "./config/app-config.service";
import { BusinessCodePrefixService } from "./code/business-code-prefix.service";
import { RequestContextService } from "./request-context/request-context.service";

@Global()
@Module({
  providers: [
    AppConfigService,
    RequestContextService,
    BusinessCodePrefixService,
  ],
  exports: [AppConfigService, RequestContextService, BusinessCodePrefixService],
})
export class CommonModule {}
