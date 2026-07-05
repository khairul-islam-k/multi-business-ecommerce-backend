import { SystemUserType } from "@/database/schema";
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

import { AuthenticatedRequest } from "../strategies/jwt.strategy";

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException(
        "Administrator authentication is required for this request. Please sign in with an administrator account and send a valid Bearer access token before trying again.",
      );
    }

    if (user.type !== SystemUserType.ADMIN) {
      throw new ForbiddenException(
        "Your account is authenticated, but this endpoint is restricted to administrator accounts. Sign in with an administrator account or request elevated access.",
      );
    }

    return true;
  }
}
