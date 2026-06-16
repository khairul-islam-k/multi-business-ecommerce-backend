import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { SystemUserType } from "@/database/schema";
import { isUUID } from "class-validator";

import {
  REQUIRED_PERMISSION_KEY,
  RequiredPermissionMeta,
} from "../decorators/require-permission.decorator";
import { PermissionService } from "../permission.service";
import type { AuthenticatedRequest } from "../../auth/strategies/jwt.strategy";

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const requiredPermission =
      this.reflector.getAllAndOverride<RequiredPermissionMeta>(
        REQUIRED_PERMISSION_KEY,
        [context.getHandler(), context.getClass()],
      );

    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const user = request.user;

    if (!user) {
      throw new UnauthorizedException("Unauthorized");
    }

    const businessId = this.getTargetBusinessId(request, requiredPermission);

    if (businessId === null) {
      request.businessId = null;
      request.businessContext = null;

      return true;
    }

    const businessContext =
      request.businessContext?.businessId === businessId
        ? request.businessContext
        : null;

    await this.permissionService.assertPermission(
      user,
      businessId,
      requiredPermission.feature,
      requiredPermission.action,
      {
        isOwner: businessContext?.isOwner,
        skipBusinessAccessCheck: businessContext !== null,
      },
    );

    request.businessId = businessId;

    return true;
  }

  private getTargetBusinessId(
    request: AuthenticatedRequest,
    requiredPermission: RequiredPermissionMeta,
  ): string | null {
    const rawParam = request.params?.[requiredPermission.businessIdParam];

    if (rawParam !== undefined) {
      const businessId = String(rawParam);

      if (!isUUID(businessId)) {
        throw new BadRequestException("Invalid business ID");
      }

      return businessId;
    }

    if (request.user?.type === SystemUserType.ADMIN) {
      return null;
    }

    if (!request.user?.businessId) {
      throw new ForbiddenException("You do not have access to this business");
    }

    return request.user.businessId;
  }
}
