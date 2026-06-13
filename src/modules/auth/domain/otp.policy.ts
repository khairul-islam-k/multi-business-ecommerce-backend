import { randomInt } from "node:crypto";

import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class OtpPolicy {
  private readonly maxAttempts: number;
  private readonly expiresInMinutes: number;

  constructor(configService: ConfigService) {
    this.maxAttempts = configService.getOrThrow<number>("OTP_MAX_ATTEMPT");
    this.expiresInMinutes = configService.getOrThrow<number>(
      "OTP_EXPIRES_IN_MINS",
    );
  }

  generateOtp() {
    return String(randomInt(100000, 1000000));
  }

  getExpiresAt() {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.expiresInMinutes);

    return expiresAt;
  }

  assertCanAttempt(
    attemptCount: number,
    message = "Too many attempts. Please request a new OTP",
  ) {
    if (attemptCount >= this.maxAttempts) {
      throw new BadRequestException(message);
    }
  }
}
