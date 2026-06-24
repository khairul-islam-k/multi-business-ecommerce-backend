import { describe, expect, it } from "@jest/globals";

import { validateAppConfig } from "./app-config.schema";

const baseConfig = {
  APP_NAME: "Onecomm",
  APP_PORT: "8080",
  APP_IP: "localhost",
  APP_CORS_ORIGINS: "http://localhost:3000",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/onecomm",
  JWT_ACCESS_SECRET: "access-secret",
  JWT_ACCESS_EXPIRES_IN: "30m",
  JWT_REFRESH_EXPIRES_IN_DAYS: "30",
  MEDIA_UPLOAD_ROOT: "uploads",
  PUBLIC_UPLOAD_PREFIX: "/uploads",
  MEDIA_MAX_IMAGE_SIZE_BYTES: "5242880",
  MEDIA_MAX_BULK_IMAGE_FILES: "20",
  MEDIA_MAX_BULK_DELETE_IMAGES: "100",
  MAIL_PASS: "mail-pass",
  MAIL_HOST: "smtp.example.test",
  MAIL_PORT: "587",
  MAIL_USER: "mail-user",
  MAIL_FROM: "noreply@example.test",
  OTP_SECRET: "otp-secret",
  OTP_MAX_ATTEMPT: "5",
  OTP_EXPIRES_IN_MINS: "10",
};

describe("validateAppConfig", () => {
  it("rejects wildcard CORS origins", () => {
    expect(() =>
      validateAppConfig({
        ...baseConfig,
        APP_CORS_ORIGINS: "*",
      }),
    ).toThrow("APP_CORS_ORIGINS cannot include *");
  });

  it("rejects wildcard CORS subdomain bases", () => {
    expect(() =>
      validateAppConfig({
        ...baseConfig,
        APP_CORS_SUBDOMAIN_BASES: "*",
      }),
    ).toThrow("APP_CORS_SUBDOMAIN_BASES cannot include *");
  });

  it("validates app port and public upload prefix", () => {
    expect(() =>
      validateAppConfig({ ...baseConfig, APP_PORT: "99999" }),
    ).toThrow("APP_PORT must not be greater than 65535");
    expect(() =>
      validateAppConfig({ ...baseConfig, PUBLIC_UPLOAD_PREFIX: "uploads" }),
    ).toThrow("PUBLIC_UPLOAD_PREFIX must start with /");
  });

  it("requires shared module configuration", () => {
    expect(() =>
      validateAppConfig({ ...baseConfig, JWT_ACCESS_SECRET: "" }),
    ).toThrow("JWT_ACCESS_SECRET should not be empty");
    expect(() =>
      validateAppConfig({ ...baseConfig, MEDIA_MAX_IMAGE_SIZE_BYTES: "0" }),
    ).toThrow("MEDIA_MAX_IMAGE_SIZE_BYTES must not be less than 1");
  });
});
