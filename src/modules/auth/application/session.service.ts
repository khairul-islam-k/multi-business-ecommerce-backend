import { and, eq, gt, isNull } from "drizzle-orm";

import { systemSession, systemUser } from "@/database/schema";
import { Injectable, UnauthorizedException } from "@nestjs/common";

import { DatabaseService } from "../../../database/database.service";
import { JwtPayload } from "../strategies/jwt.strategy";
import { TokenService } from "./token.service";

@Injectable()
export class SessionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly tokenService: TokenService,
  ) {}

  async issueTokenPair(payload: JwtPayload) {
    const tokens = await this.tokenService.createTokenPair(payload);

    await this.database.db.insert(systemSession).values({
      userId: payload.sub,
      businessId: payload.businessId ?? null,
      refreshTokenHash: this.tokenService.hashRefreshToken(tokens.refreshToken),
      expiresAt: this.tokenService.getRefreshTokenExpiresAt(),
    });

    return tokens;
  }

  async findByRefreshToken(refreshToken: string) {
    return this.database.db
      .select({
        session: systemSession,
        user: systemUser,
      })
      .from(systemSession)
      .innerJoin(systemUser, eq(systemUser.id, systemSession.userId))
      .where(
        eq(
          systemSession.refreshTokenHash,
          this.tokenService.hashRefreshToken(refreshToken),
        ),
      )
      .limit(1)
      .then((items) => {
        const item = items[0];

        if (!item) {
          return null;
        }

        return {
          ...item.session,
          user: item.user,
        };
      });
  }

  async revokeSession(sessionId: string, revokedAt = new Date()) {
    await this.database.db
      .update(systemSession)
      .set({
        revokedAt,
      })
      .where(
        and(eq(systemSession.id, sessionId), isNull(systemSession.revokedAt)),
      );
  }

  async rotateRefreshSession(command: {
    sessionId: string;
    userId: string;
    businessId: string | null;
    revokedAt: Date;
  }) {
    const refreshToken = this.tokenService.generateRefreshToken();

    await this.database.db.transaction(async (tx) => {
      const revokedSession = await tx
        .update(systemSession)
        .set({
          revokedAt: command.revokedAt,
        })
        .where(
          and(
            eq(systemSession.id, command.sessionId),
            isNull(systemSession.revokedAt),
          ),
        )
        .returning({ id: systemSession.id });

      if (revokedSession.length !== 1) {
        throw new UnauthorizedException(
          "This session token has already been used. Please login again to continue safely.",
        );
      }

      await tx.insert(systemSession).values({
        userId: command.userId,
        businessId: command.businessId,
        refreshTokenHash: this.tokenService.hashRefreshToken(refreshToken),
        expiresAt: this.tokenService.getRefreshTokenExpiresAt(),
      });
    });

    return refreshToken;
  }

  async bindRefreshSessionToBusiness(
    userId: string,
    refreshToken: string,
    businessId: string,
  ) {
    const result = await this.database.db
      .update(systemSession)
      .set({
        businessId,
      })
      .where(
        and(
          eq(systemSession.userId, userId),
          eq(
            systemSession.refreshTokenHash,
            this.tokenService.hashRefreshToken(refreshToken),
          ),
          isNull(systemSession.revokedAt),
          gt(systemSession.expiresAt, new Date()),
        ),
      )
      .returning({ id: systemSession.id });

    if (result.length !== 1) {
      throw new UnauthorizedException(
        "This session could not be matched to an active login-session. Please login before switching businesses.",
      );
    }
  }

  async revokeByRefreshToken(refreshToken: string, userId?: string) {
    await this.database.db
      .update(systemSession)
      .set({
        revokedAt: new Date(),
      })
      .where(
        and(
          eq(
            systemSession.refreshTokenHash,
            this.tokenService.hashRefreshToken(refreshToken),
          ),
          isNull(systemSession.revokedAt),
          userId !== undefined ? eq(systemSession.userId, userId) : undefined,
        ),
      );
  }

  async revokeAllUserSessions(userId: string) {
    await this.database.db
      .update(systemSession)
      .set({
        revokedAt: new Date(),
      })
      .where(
        and(eq(systemSession.userId, userId), isNull(systemSession.revokedAt)),
      );
  }
}
