import { Request, Response } from "express";

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";

import { AppConfigService } from "../config/app-config.service";
import { getDatabaseErrorMetadata } from "../database/db-error.util";

const PRODUCTION_INTERNAL_ERROR_MESSAGE =
  "The server encountered an unexpected error while processing this request. Please retry the request, and contact support with the request ID if the problem continues.";

type RequestWithMeta = Request & {
  requestId?: string;
};

type NormalizedError = {
  message: string;
  errors?: unknown;
  error?: string;
  exposeMessage?: boolean;
  statusCode?: number;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exception");

  constructor(private readonly appConfig: AppConfigService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<RequestWithMeta>();
    const res = ctx.getResponse<Response>();

    const normalized = this.normalizeException(exception);
    const status =
      normalized.statusCode ??
      (exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR);

    const requestId =
      req.requestId ||
      (typeof req.headers["x-request-id"] === "string"
        ? req.headers["x-request-id"]
        : undefined);

    const logMessage = [
      req.method,
      req.originalUrl,
      status,
      `req=${requestId ?? "unknown"}`,
      `message="${normalized.message}"`,
    ].join(" ");

    if (status >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(logMessage, stack);
    } else {
      this.logger.warn(logMessage);
    }

    res.status(status).json({
      success: false,
      statusCode: status,
      message:
        status >= 500 &&
        this.appConfig.isProduction &&
        !normalized.exposeMessage
          ? PRODUCTION_INTERNAL_ERROR_MESSAGE
          : normalized.message,
      errors: normalized.errors,
      error: normalized.error,
      path: req.originalUrl,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }

  private normalizeException(exception: unknown): NormalizedError {
    const databaseError = getDatabaseErrorMetadata(exception);

    if (databaseError) {
      return {
        statusCode: databaseError.statusCode,
        message: databaseError.message,
        errors: databaseError.errors,
        error: databaseError.error,
        exposeMessage: true,
      };
    }

    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === "string") {
        return {
          message: response,
        };
      }

      if (this.isRecord(response)) {
        const responseMessage = response.message;

        // TODO: is it safe to convert types like this?
        return {
          message: (Array.isArray(responseMessage)
            ? responseMessage[0]
            : typeof responseMessage === "string"
              ? responseMessage
              : exception.message) as string,
          errors: Array.isArray(responseMessage) ? responseMessage : undefined,
          error:
            typeof response.error === "string" ? response.error : undefined,
        };
      }

      return {
        message: exception.message,
      };
    }

    if (exception instanceof Error) {
      return {
        message: exception.message || PRODUCTION_INTERNAL_ERROR_MESSAGE,
      };
    }

    return {
      message: PRODUCTION_INTERNAL_ERROR_MESSAGE,
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }
}
