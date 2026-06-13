import { NextFunction, Request, Response } from "express";
import { Injectable, Logger, NestMiddleware } from "@nestjs/common";

import type { CurrentUserPayload } from "../../modules/auth/decorators/current-user.decorator";

type RequestWithMeta = Request & {
  requestId?: string;
  user?: CurrentUserPayload;
};

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  use(req: RequestWithMeta, res: Response, next: NextFunction) {
    const startedAt = process.hrtime.bigint();

    res.on("finish", () => {
      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;

      const message = [
        req.method,
        req.originalUrl,
        res.statusCode,
        `${durationMs.toFixed(1)}ms`,
      ].join(" ");

      if (res.statusCode >= 500) {
        this.logger.error(message);
        return;
      }

      if (res.statusCode >= 400) {
        this.logger.warn(message);
        return;
      }

      this.logger.log(message);
    });

    next();
  }
}
