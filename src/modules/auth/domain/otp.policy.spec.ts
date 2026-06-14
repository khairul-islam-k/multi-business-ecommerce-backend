import { describe, expect, it, jest } from "@jest/globals";
import { BadRequestException } from "@nestjs/common";

import { OtpPolicy } from "./otp.policy";

function createOtpPolicy(config: Record<string, number>) {
  const configService = {
    getOrThrow: jest.fn((key: string) => config[key]),
  };

  return new OtpPolicy(configService as never);
}

describe("OtpPolicy", () => {
  it("generates six digit OTP values", () => {
    const policy = createOtpPolicy({
      OTP_MAX_ATTEMPT: 3,
      OTP_EXPIRES_IN_MINS: 5,
    });

    expect(policy.generateOtp()).toMatch(/^\d{6}$/);
  });

  it("blocks attempts at the configured maximum", () => {
    const policy = createOtpPolicy({
      OTP_MAX_ATTEMPT: 3,
      OTP_EXPIRES_IN_MINS: 5,
    });

    expect(() => policy.assertCanAttempt(3)).toThrow(BadRequestException);
  });

  it("creates an expiry in the future", () => {
    const policy = createOtpPolicy({
      OTP_MAX_ATTEMPT: 3,
      OTP_EXPIRES_IN_MINS: 5,
    });

    expect(policy.getExpiresAt().getTime()).toBeGreaterThan(Date.now());
  });
});
