import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { AppService } from "./app.service";

@ApiTags("Test")
@Controller("test")
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiOperation({
    summary: "Server ping test",
    description:
      "Checks whether the server is running and able to answer a simple request. This is useful for confirming that the API application itself is online.",
  })
  @Get("/ping")
  ping() {
    return this.appService.ping();
  }

  @ApiOperation({
    summary: "Database readiness test",
    description:
      "Checks whether the server can reach the database. This is useful before troubleshooting features that need saved business data.",
  })
  @Get("/ping-database")
  ready() {
    return this.appService.ready();
  }
}
