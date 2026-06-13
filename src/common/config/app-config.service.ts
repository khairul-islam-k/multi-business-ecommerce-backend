import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { parseCorsOrigins } from "./cors.config";

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  get appName() {
    return this.configService.getOrThrow<string>("APP_NAME");
  }

  get nodeEnv() {
    return this.configService.getOrThrow<string>("NODE_ENV");
  }

  get isProduction() {
    return this.nodeEnv === "production";
  }

  get appPort() {
    return this.configService.getOrThrow<number>("APP_PORT");
  }

  get appIp() {
    return this.configService.getOrThrow<string>("APP_IP");
  }

  get corsOrigins() {
    return parseCorsOrigins(
      this.configService.getOrThrow<string>("APP_CORS_ORIGINS"),
    );
  }

  get databaseUrl() {
    return this.configService.getOrThrow<string>("DATABASE_URL");
  }

  get jwtAccessSecret() {
    return this.configService.getOrThrow<string>("JWT_ACCESS_SECRET");
  }

  get jwtAccessExpiresIn() {
    return this.configService.getOrThrow<string>("JWT_ACCESS_EXPIRES_IN");
  }

  get jwtRefreshExpiresInDays() {
    return this.configService.getOrThrow<number>("JWT_REFRESH_EXPIRES_IN_DAYS");
  }

  get mediaUploadRoot() {
    return this.configService.getOrThrow<string>("MEDIA_UPLOAD_ROOT");
  }

  get publicUploadPrefix() {
    return this.configService.getOrThrow<string>("PUBLIC_UPLOAD_PREFIX");
  }

  get mediaLimits() {
    return {
      maxBulkImageFiles: this.configService.getOrThrow<number>(
        "MEDIA_MAX_BULK_IMAGE_FILES",
      ),
      maxBulkDeleteImages: this.configService.getOrThrow<number>(
        "MEDIA_MAX_BULK_DELETE_IMAGES",
      ),
      maxImageSizeBytes: this.configService.getOrThrow<number>(
        "MEDIA_MAX_IMAGE_SIZE_BYTES",
      ),
    };
  }

  get mail() {
    return {
      from: this.configService.getOrThrow<string>("MAIL_FROM"),
      host: this.configService.getOrThrow<string>("MAIL_HOST"),
      port: this.configService.getOrThrow<number>("MAIL_PORT"),
      user: this.configService.getOrThrow<string>("MAIL_USER"),
      pass: this.configService.getOrThrow<string>("MAIL_PASS"),
    };
  }

  get otp() {
    return {
      secret: this.configService.getOrThrow<string>("OTP_SECRET"),
      maxAttempts: this.configService.getOrThrow<number>("OTP_MAX_ATTEMPT"),
      expiresInMinutes: this.configService.getOrThrow<number>(
        "OTP_EXPIRES_IN_MINS",
      ),
    };
  }
}
