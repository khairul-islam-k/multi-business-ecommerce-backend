import { Injectable, UnauthorizedException } from "@nestjs/common";

import { TokenService } from "./token.service";
import { JwtPayload } from "../strategies/jwt.strategy";
import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async issueTokenPair(payload: JwtPayload) {
    const tokens = await this.tokens.createTokenPair(payload);

    await this.prisma.systemSession.create({
      data: {
        userId: payload.sub,
        businessId: payload.businessId ?? null,
        refreshTokenHash: this.tokens.hashRefreshToken(tokens.refreshToken),
        expiresAt: this.tokens.getRefreshTokenExpiresAt(),
      },
    });

    return tokens;
  }

  findByRefreshToken(refreshToken: string) {
    return this.prisma.systemSession.findUnique({
      where: {
        refreshTokenHash: this.tokens.hashRefreshToken(refreshToken),
      },
      include: {
        user: true,
      },
    });
  }

  async revokeSession(sessionId: string, revokedAt = new Date()) {
    await this.prisma.systemSession.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
      },
      data: {
        revokedAt,
      },
    });
  }

  async rotateRefreshSession(command: {
    sessionId: string;
    userId: string;
    businessId: string | null;
    revokedAt: Date;
  }) {
    const refreshToken = this.tokens.generateRefreshToken();

    await this.prisma.$transaction(async (tx) => {
      const revokedSession = await tx.systemSession.updateMany({
        where: {
          id: command.sessionId,
          revokedAt: null,
        },
        data: {
          revokedAt: command.revokedAt,
        },
      });

      if (revokedSession.count !== 1) {
        throw new UnauthorizedException("Refresh token has already been used");
      }

      await tx.systemSession.create({
        data: {
          userId: command.userId,
          businessId: command.businessId,
          refreshTokenHash: this.tokens.hashRefreshToken(refreshToken),
          expiresAt: this.tokens.getRefreshTokenExpiresAt(),
        },
      });
    });

    return refreshToken;
  }

  async bindRefreshSessionToBusiness(
    userId: string,
    refreshToken: string,
    businessId: string,
  ) {
    const result = await this.prisma.systemSession.updateMany({
      where: {
        userId,
        refreshTokenHash: this.tokens.hashRefreshToken(refreshToken),
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        businessId,
      },
    });

    if (result.count !== 1) {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  async revokeByRefreshToken(refreshToken: string, userId?: string) {
    await this.prisma.systemSession.updateMany({
      where: {
        refreshTokenHash: this.tokens.hashRefreshToken(refreshToken),
        revokedAt: null,
        ...(userId !== undefined ? { userId } : {}),
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async revokeAllUserSessions(userId: string) {
    await this.prisma.systemSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}
