import { createHash } from "node:crypto";

import { SystemUserType } from "@/database/schema";
import { afterEach, describe, expect, it, jest } from "@jest/globals";

import { TokenService } from "./token.service";

function createTokenService(
  config: {
    jwtAccessSecret?: string;
    jwtRefreshExpiresInDays?: unknown;
  } = {},
) {
  const hasRefreshExpiry = Object.prototype.hasOwnProperty.call(
    config,
    "jwtRefreshExpiresInDays",
  );
  const jwt = {
    signAsync: jest.fn(
      async (_payload: unknown, _options: unknown) => "signed",
    ),
  };
  const configs = {
    jwtAccessSecret: config.jwtAccessSecret ?? "access-secret",
    jwtRefreshExpiresInDays: hasRefreshExpiry
      ? config.jwtRefreshExpiresInDays
      : 30,
  };

  return {
    configs,
    jwt,
    service: new TokenService(jwt as never, configs as never),
  };
}

describe("TokenService", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("signs access tokens with the configured access secret", async () => {
    const { jwt, service } = createTokenService({
      jwtAccessSecret: "jwt-secret",
    });
    const payload = {
      sub: "user-id",
      type: SystemUserType.TENANT,
      businessId: "business-id",
    };

    await expect(service.generateAccessToken(payload)).resolves.toBe("signed");

    expect(jwt.signAsync).toHaveBeenCalledWith(payload, {
      secret: "jwt-secret",
    });
  });

  it("generates opaque refresh tokens", () => {
    const { service } = createTokenService();

    const refreshToken = service.generateRefreshToken();

    expect(refreshToken).toMatch(/^[a-f0-9]{128}$/);
    expect(service.generateRefreshToken()).not.toBe(refreshToken);
  });

  it("hashes refresh tokens with sha256", () => {
    const { service } = createTokenService();

    expect(service.hashRefreshToken("refresh-token")).toBe(
      createHash("sha256").update("refresh-token").digest("hex"),
    );
  });

  it("calculates refresh token expiry from the configured day count", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-01-15T00:00:00.000Z"));
    const { service } = createTokenService({
      jwtRefreshExpiresInDays: 7,
    });

    expect(service.getRefreshTokenExpiresAt()).toEqual(
      new Date("2026-01-22T00:00:00.000Z"),
    );
  });

  it.each([0, -1, 1.5, "not-a-number", undefined])(
    "rejects invalid refresh token expiry config: %p",
    (jwtRefreshExpiresInDays) => {
      const { service } = createTokenService({ jwtRefreshExpiresInDays });

      expect(() => service.getRefreshTokenExpiresAt()).toThrow(
        "JWT_REFRESH_EXPIRES_IN_DAYS must be a positive integer",
      );
    },
  );

  it("creates access and refresh token pairs", async () => {
    const { jwt, service } = createTokenService({
      jwtAccessSecret: "pair-secret",
    });
    const payload = {
      sub: "user-id",
      type: SystemUserType.ADMIN,
      businessId: null,
    };

    await expect(service.createTokenPair(payload)).resolves.toEqual({
      accessToken: "signed",
      refreshToken: expect.stringMatching(/^[a-f0-9]{128}$/),
    });

    expect(jwt.signAsync).toHaveBeenCalledWith(payload, {
      secret: "pair-secret",
    });
  });
});
