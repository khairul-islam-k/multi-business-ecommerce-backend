import { createHash, randomBytes } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

import { JwtPayload } from "../strategies/jwt.strategy";

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async generateAccessToken(payload: JwtPayload) {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
    });
  }

  generateRefreshToken() {
    return randomBytes(64).toString("hex");
  }

  hashRefreshToken(refreshToken: string) {
    return createHash("sha256").update(refreshToken).digest("hex");
  }

  getRefreshTokenExpiresAt() {
    const rawDays = this.configService.getOrThrow<string>(
      "JWT_REFRESH_EXPIRES_IN_DAYS",
    );

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
