import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { SystemUserType } from "@/database/schema";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import { PackageSubscriptionService } from "../package-subscription.service";

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly subscriptions: PackageSubscriptionService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      user?: CurrentUserPayload;
    }>();

    const user = request.user;

    if (!user) {
      throw new UnauthorizedException("Unauthorized");
    }

    if (user.type === SystemUserType.ADMIN) {
      return true;
    }

    await this.subscriptions.assertTenantSubscriptionActive(user);

    return true;
  }
}
