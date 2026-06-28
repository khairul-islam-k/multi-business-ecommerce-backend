import { SystemUserType } from "@/database/schema";
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

import { PackageSubscriptionService } from "../package-subscription.service";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly subscriptions: PackageSubscriptionService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      user?: CurrentUserPayload;
    }>();

    const user = request.user;

    if (!user) {
      throw new UnauthorizedException(
        "Authentication is required before subscription access can be checked. Please sign in, send a valid Bearer access token, and retry this request.",
      );
    }

    if (user.type === SystemUserType.ADMIN) {
      return true;
    }

    await this.subscriptions.assertTenantSubscriptionActive(user);

    return true;
  }
}
