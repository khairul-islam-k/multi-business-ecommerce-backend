import { createHash, randomBytes } from "node:crypto";

import { AppConfigService } from "@/common/config/app-config.service";
import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import type { CustomerJwtPayload } from "../strategies/customer-jwt.strategy";

@Injectable()
export class CustomerTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly configs: AppConfigService,
  ) {}

  async generateAccessToken(payload: CustomerJwtPayload) {
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
    const expiresAt = new Date();
    expiresAt.setDate(
      expiresAt.getDate() + Number(this.configs.jwtRefreshExpiresInDays),
    );

    return expiresAt;
  }

  async createTokenPair(payload: CustomerJwtPayload) {
    return {
      accessToken: await this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(),
    };
  }
}
