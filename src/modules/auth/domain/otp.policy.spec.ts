import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { BadRequestException } from "@nestjs/common";

import { OtpPolicy } from "./otp.policy";

function createOtpPolicy(
  config: {
    maxAttempts?: number;
    expiresInMinutes?: number;
  } = {},
) {
  const configs = {
    otp: {
      secret: "otp-secret",
      maxAttempts: config.maxAttempts ?? 3,
      expiresInMinutes: config.expiresInMinutes ?? 5,
    },
  };

  return new OtpPolicy(configs as never);
}

describe("OtpPolicy", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("generates six digit OTP values", () => {
    const policy = createOtpPolicy();

    expect(policy.generateOtp()).toMatch(/^\d{6}$/);
  });

  it("allows attempts below the configured maximum", () => {
    const policy = createOtpPolicy({
      maxAttempts: 3,
    });

    expect(() => policy.assertCanAttempt(2)).not.toThrow();
  });

  it("blocks attempts at the configured maximum", () => {
    const policy = createOtpPolicy({
      maxAttempts: 3,
    });

    expect(() => policy.assertCanAttempt(3)).toThrow(BadRequestException);
  });

  it("uses the supplied lockout message when blocking attempts", () => {
    const policy = createOtpPolicy({
      maxAttempts: 3,
    });

    expect(() => policy.assertCanAttempt(3, "Custom OTP limit")).toThrow(
      "Custom OTP limit",
    );
  });

  it("creates an expiry from the configured minute count", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-01-15T10:00:00.000Z"));
    const policy = createOtpPolicy({
      expiresInMinutes: 10,
    });

    expect(policy.getExpiresAt()).toEqual(
      new Date("2026-01-15T10:10:00.000Z"),
    );
  });
});
