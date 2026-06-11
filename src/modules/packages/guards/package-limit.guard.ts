import { Reflector } from "@nestjs/core";
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

import { PackageLimitService } from "../package-limit.service";
import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import {
  PACKAGE_LIMIT_METADATA_KEY,
  type PackageLimitRequirement,
} from "../decorators/require-package-limit.decorator";

@Injectable()
export class PackageLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly packageLimits: PackageLimitService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const requirement =
      this.reflector.getAllAndOverride<PackageLimitRequirement>(
        PACKAGE_LIMIT_METADATA_KEY,
        [context.getHandler(), context.getClass()],
      );

    if (!requirement) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: CurrentUserPayload;
      body?: Record<string, unknown>;
      file?: unknown;
      files?: unknown[] | Record<string, unknown[]>;
    }>();

    if (!request.user) {
      throw new UnauthorizedException("Unauthorized access");
    }

    const amount = this.resolveAmount(request, requirement);

    await this.packageLimits.assertWithinLimit(
      request.user,
      requirement.limitKey,
      amount,
    );

    return true;
  }

  private resolveAmount(
    request: {
      body?: Record<string, unknown>;
      files?: unknown[] | Record<string, unknown[]>;
    },
    requirement: PackageLimitRequirement,
  ) {
    if (requirement.filesField) {
      const files = request.files;

      if (Array.isArray(files)) {
        return Math.max(files.length, 1);
      }

      if (files && Array.isArray(files[requirement.filesField])) {
        return Math.max(files[requirement.filesField].length, 1);
      }
    }

    if (requirement.bodyField && request.body) {
      const rawAmount = request.body[requirement.bodyField];
      const amount = Number(rawAmount);

      if (Number.isInteger(amount) && amount > 0) {
        return amount;
      }
    }

    return requirement.amount ?? 1;
  }
}
