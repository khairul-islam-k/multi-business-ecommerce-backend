import { randomInt } from "node:crypto";

import { AppConfigService } from "@/common/config/app-config.service";
import { BadRequestException, Injectable } from "@nestjs/common";

@Injectable()
export class OtpPolicy {
  private readonly maxAttempts: number;
  private readonly expiresInMinutes: number;

  constructor(configs: AppConfigService) {
    this.maxAttempts = configs.otp.maxAttempts;
    this.expiresInMinutes = configs.otp.expiresInMinutes;
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
