import { and, eq, isNull } from "drizzle-orm";

import { customer, customerAccount, customerSession } from "@/database/schema";
import { Injectable, UnauthorizedException } from "@nestjs/common";

import { DatabaseService } from "../../../database/database.service";
import { CustomerTokenService } from "./customer-token.service";

import type { CustomerJwtPayload } from "../strategies/customer-jwt.strategy";

@Injectable()
export class CustomerSessionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly tokens: CustomerTokenService,
  ) {}

  async issueTokenPair(payload: CustomerJwtPayload) {
    const tokens = await this.tokens.createTokenPair(payload);

    await this.database.db.insert(customerSession).values({
      accountId: payload.sub,
      websiteId: payload.websiteId,
      refreshTokenHash: this.tokens.hashRefreshToken(tokens.refreshToken),
      expiresAt: this.tokens.getRefreshTokenExpiresAt(),
    });

    return tokens;
  }

  async findByRefreshToken(refreshToken: string) {
    const [row] = await this.database.db
      .select({
        session: customerSession,
        account: customerAccount,
        customer,
      })
      .from(customerSession)
      .innerJoin(
        customerAccount,
        eq(customerAccount.id, customerSession.accountId),
      )
      .innerJoin(customer, eq(customer.id, customerAccount.customerId))
      .where(
        eq(
          customerSession.refreshTokenHash,
          this.tokens.hashRefreshToken(refreshToken),
        ),
      )
      .limit(1);

    if (!row) {
      return null;
    }

    return {
      ...row.session,
      account: row.account,
      customer: row.customer,
    };
  }

  async rotateRefreshSession(command: {
    sessionId: string;
    payload: CustomerJwtPayload;
    revokedAt: Date;
  }) {
    const refreshToken = this.tokens.generateRefreshToken();

    await this.database.db.transaction(async (tx) => {
      const revokedSession = await tx
        .update(customerSession)
        .set({ revokedAt: command.revokedAt })
        .where(
          and(
            eq(customerSession.id, command.sessionId),
            isNull(customerSession.revokedAt),
          ),
        )
        .returning({ id: customerSession.id });

      if (revokedSession.length !== 1) {
        throw new UnauthorizedException(
          "This customer session token has already been used. Please login again.",
        );
      }

      await tx.insert(customerSession).values({
        accountId: command.payload.sub,
        websiteId: command.payload.websiteId,
        refreshTokenHash: this.tokens.hashRefreshToken(refreshToken),
        expiresAt: this.tokens.getRefreshTokenExpiresAt(),
      });
    });

    return refreshToken;
  }

  async revokeByRefreshToken(refreshToken: string, accountId?: string) {
    await this.database.db
      .update(customerSession)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(
            customerSession.refreshTokenHash,
            this.tokens.hashRefreshToken(refreshToken),
          ),
          isNull(customerSession.revokedAt),
          accountId ? eq(customerSession.accountId, accountId) : undefined,
        ),
      );
  }

  assertRefreshSessionActive(session: {
    revokedAt: Date | null;
    expiresAt: Date;
  }) {
    const now = new Date();

    if (session.revokedAt) {
      throw new UnauthorizedException("Customer session has been revoked");
    }

    if (session.expiresAt <= now) {
      throw new UnauthorizedException("Customer session has expired");
    }
  }
}
