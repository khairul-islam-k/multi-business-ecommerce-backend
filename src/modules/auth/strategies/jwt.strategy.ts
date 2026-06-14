import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { SystemUserStatus, SystemUserType } from "@prisma/client";
import { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";

import type { CurrentUserPayload } from "../decorators/current-user.decorator";
import { PrismaService } from "../../../prisma/prisma.service";
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
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload): Promise<CurrentUserPayload> {
    const user = await this.prisma.systemUser.findUnique({
      where: {
        id: payload.sub,
      },
      select: {
        id: true,
        name: true,
        email: true,
        type: true,
        status: true,
        tenantId: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid token");
    }

    if (user.status !== SystemUserStatus.ACTIVE) {
      throw new UnauthorizedException("Account is not active");
    }

    if (payload.type !== user.type) {
      throw new UnauthorizedException("Invalid token");
    }

    if (user.type === SystemUserType.ADMIN) {
      return {
        ...user,
        businessId: null,
      };
    }

    if (!payload.businessId) {
      throw new UnauthorizedException("No business selected");
    }

    return {
      ...user,
      businessId: payload.businessId,
    };
  }
}
