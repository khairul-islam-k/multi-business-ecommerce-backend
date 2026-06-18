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
        "Authentication required. Please login continue.",
      );
    }

    if (user.type !== SystemUserType.ADMIN) {
      throw new ForbiddenException(
        "Unauthorized access. Only admin can access this resource.",
      );
    }

    return true;
  }
}
