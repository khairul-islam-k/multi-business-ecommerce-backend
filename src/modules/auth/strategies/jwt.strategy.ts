import { eq } from "drizzle-orm";
import { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";

import { AppConfigService } from "@/common/config/app-config.service";
import {
  systemUser,
  SystemUserStatus,
  SystemUserType,
} from "@/database/schema";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";

import { DatabaseService } from "../../../database/database.service";

import type { CurrentUserPayload } from "../decorators/current-user.decorator";
import type { BusinessAccessContext } from "../../../common/request-context/request-context.types";
export type JwtPayload = {
  sub: string;
  businessId: string | null;
  type: SystemUserType;
};

export type AuthenticatedRequest = Request & {
  user: CurrentUserPayload;
  businessId?: string | null;
  businessContext?: BusinessAccessContext | null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    private readonly database: DatabaseService,
    configs: AppConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configs.jwtAccessSecret,
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload): Promise<CurrentUserPayload> {
    const [user] = await this.database.db
      .select({
        id: systemUser.id,
        name: systemUser.name,
        email: systemUser.email,
        type: systemUser.type,
        status: systemUser.status,
        tenantId: systemUser.tenantId,
      })
      .from(systemUser)
      .where(eq(systemUser.id, payload.sub))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException(
        "The access token is missing, expired, malformed, or belongs to a user account that no longer exists. Please sign in again to get a fresh token.",
      );
    }

    if (user.status !== SystemUserStatus.ACTIVE) {
      throw new UnauthorizedException(
        `This account cannot use the API because its current status is ${user.status}. Please complete the required activation steps or contact an administrator before trying again.`,
      );
    }

    if (payload.type !== user.type) {
      throw new UnauthorizedException(
        "The access token does not match the current user account type. Please sign in again so the API receives a token with the correct account context.",
      );
    }

    if (user.type === SystemUserType.ADMIN) {
      return {
        ...user,
        businessId: null,
      };
    }

    if (!payload.businessId) {
      throw new UnauthorizedException(
        "This access token does not include an active business context. Please select a business again so future requests can be scoped to the correct tenant workspace.",
      );
    }

    return {
      ...user,
      businessId: payload.businessId,
    };
  }
}
