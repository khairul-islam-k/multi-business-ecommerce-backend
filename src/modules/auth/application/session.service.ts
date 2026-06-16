import { Injectable, UnauthorizedException } from "@nestjs/common";
import { and, eq, gt, isNull } from "drizzle-orm";
import { systemSession, systemUser } from "@/database/schema";

import { DatabaseService } from "../../../database/database.service";
import { TokenService } from "./token.service";
import { JwtPayload } from "../strategies/jwt.strategy";

@Injectable()
export class SessionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly tokens: TokenService,
  ) {}

  async issueTokenPair(payload: JwtPayload) {
    const tokens = await this.tokens.createTokenPair(payload);

    await this.database.db.insert(systemSession).values({
        userId: payload.sub,
        businessId: payload.businessId ?? null,
        refreshTokenHash: this.tokens.hashRefreshToken(tokens.refreshToken),
        expiresAt: this.tokens.getRefreshTokenExpiresAt(),
    });

    return tokens;
  }

  findByRefreshToken(refreshToken: string) {
    return this.database.db
      .select({
        session: systemSession,
        user: systemUser,
      })
      .from(systemSession)
      .innerJoin(systemUser, eq(systemUser.id, systemSession.userId))
      .where(eq(systemSession.refreshTokenHash, this.tokens.hashRefreshToken(refreshToken)))
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
      .where(and(eq(systemSession.id, sessionId), isNull(systemSession.revokedAt)));
  }

  async rotateRefreshSession(command: {
    sessionId: string;
    userId: string;
    businessId: string | null;
    revokedAt: Date;
  }) {
    const refreshToken = this.tokens.generateRefreshToken();

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
          "This session token has already been used. Please sign in again to continue safely.",
        );
      }

      await tx.insert(systemSession).values({
          userId: command.userId,
          businessId: command.businessId,
          refreshTokenHash: this.tokens.hashRefreshToken(refreshToken),
          expiresAt: this.tokens.getRefreshTokenExpiresAt(),
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
          eq(systemSession.refreshTokenHash, this.tokens.hashRefreshToken(refreshToken)),
          isNull(systemSession.revokedAt),
          gt(systemSession.expiresAt, new Date()),
        ),
      )
      .returning({ id: systemSession.id });

    if (result.length !== 1) {
      throw new UnauthorizedException(
        "This session could not be matched to an active sign-in. Please sign in again before switching businesses.",
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
          eq(systemSession.refreshTokenHash, this.tokens.hashRefreshToken(refreshToken)),
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
      .where(and(eq(systemSession.userId, userId), isNull(systemSession.revokedAt)));
  }
}
