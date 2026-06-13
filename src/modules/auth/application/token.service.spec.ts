import { createHash } from "node:crypto";
import { SystemUserType } from "@prisma/client";
import { describe, expect, it, jest } from "@jest/globals";

import { TokenService } from "./token.service";

function createTokenService(config: Record<string, string>) {
  const jwtService = {
    signAsync: jest.fn(
      async (_payload: unknown, _options: unknown) => "signed",
    ),
  };
  const configService = {
    getOrThrow: jest.fn((key: string) => config[key]),
  };

  return {
    configService,
    jwtService,
    service: new TokenService(jwtService as never, configService as never),
  };
}

describe("TokenService", () => {
  it("hashes refresh tokens with sha256", () => {
    const { service } = createTokenService({
      JWT_REFRESH_EXPIRES_IN_DAYS: "7",
    });

    expect(service.hashRefreshToken("refresh-token")).toBe(
      createHash("sha256").update("refresh-token").digest("hex"),
    );
  });

  it("preserves the access token payload when signing", async () => {
    const { jwtService, service } = createTokenService({
      JWT_ACCESS_SECRET: "secret",
      JWT_REFRESH_EXPIRES_IN_DAYS: "7",
    });
    const payload = {
      sub: "user-id",
      type: SystemUserType.TENANT,
      businessId: "business-id",
    };

    await service.generateAccessToken(payload);

    expect(jwtService.signAsync).toHaveBeenCalledWith(payload, {
      secret: "secret",
    });
  });

  it("rejects invalid refresh token expiry config", () => {
    const { service } = createTokenService({
      JWT_REFRESH_EXPIRES_IN_DAYS: "0",
    });

    expect(() => service.getRefreshTokenExpiresAt()).toThrow(
      "JWT_REFRESH_EXPIRES_IN_DAYS must be a positive integer",
    );
  });
});
