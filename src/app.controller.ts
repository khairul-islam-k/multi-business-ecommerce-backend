import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { AppService } from "./app.service";

@ApiTags("Test")
@Controller("ping")
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiOperation({ summary: "Server ping test" })
  @Get()
  ping() {
    return this.appService.ping();
  }

  @ApiOperation({ summary: "Database readiness test" })
  @Get()
  ready() {
    return this.appService.ready();
  }
}
