import { createHash, randomBytes } from "node:crypto";

import { AppConfigService } from "@/common/config/app-config.service";
import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import { JwtPayload } from "../strategies/jwt.strategy";

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly configs: AppConfigService,
  ) {}

  async generateAccessToken(payload: JwtPayload) {
    return this.jwt.signAsync(payload, {
      secret: this.configs.jwtAccessSecret,
    });
  }

  generateRefreshToken() {
    return randomBytes(64).toString("hex");
  }

  hashRefreshToken(refreshToken: string) {
    return createHash("sha256").update(refreshToken).digest("hex");
  }

  getRefreshTokenExpiresAt() {
    const rawDays = this.configs.jwtRefreshExpiresInDays;

    const days = Number(rawDays);

    if (!Number.isInteger(days) || days <= 0) {
      throw new Error("JWT_REFRESH_EXPIRES_IN_DAYS must be a positive integer");
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    return expiresAt;
  }

  async createTokenPair(payload: JwtPayload) {
    return {
      accessToken: await this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(),
    };
  }
}
