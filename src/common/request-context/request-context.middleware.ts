import { NextFunction, Request, Response } from "express";
import { Injectable, NestMiddleware } from "@nestjs/common";

import { RequestContextService } from "./request-context.service";

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContext: RequestContextService) {}

  use(_req: Request, _res: Response, next: NextFunction) {
    this.requestContext.run(() => next());
  }
}
