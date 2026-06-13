import { describe, expect, it } from "@jest/globals";

import { validateAppConfig } from "./app-config.schema";

const baseConfig = {
  APP_PORT: "8080",
  APP_IP: "localhost",
  MEDIA_UPLOAD_ROOT: "uploads",
  PUBLIC_UPLOAD_PREFIX: "/uploads",
};

describe("validateAppConfig", () => {
  it("defaults CORS origins for local development", () => {
    const config = validateAppConfig(baseConfig);

    expect(config.APP_CORS_ORIGINS).toContain("http://localhost:3000");
  });

  it("rejects wildcard CORS origins in production", () => {
    expect(() =>
      validateAppConfig({
        ...baseConfig,
        NODE_ENV: "production",
        APP_CORS_ORIGINS: "*",
      }),
    ).toThrow("APP_CORS_ORIGINS cannot include * in production");
  });

  it("validates the app port and public upload prefix", () => {
    expect(() =>
      validateAppConfig({ ...baseConfig, APP_PORT: "99999" }),
    ).toThrow("APP_PORT must be a valid TCP port");
    expect(() =>
      validateAppConfig({ ...baseConfig, PUBLIC_UPLOAD_PREFIX: "uploads" }),
    ).toThrow("PUBLIC_UPLOAD_PREFIX must start with /");
  });
});
