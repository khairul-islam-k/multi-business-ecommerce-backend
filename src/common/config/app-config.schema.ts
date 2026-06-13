type RawConfig = Record<string, unknown>;

const LOCAL_CORS_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
];

function readString(config: RawConfig, key: string) {
  const value = config[key];

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed || undefined;
}

function requireString(config: RawConfig, key: string) {
  const value = readString(config, key);

  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
}

function requirePort(config: RawConfig, key: string) {
  const rawValue = requireString(config, key);
  const port = Number(rawValue);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${key} must be a valid TCP port`);
  }

  return String(port);
}

function requirePublicPrefix(config: RawConfig, key: string) {
  const value = requireString(config, key);

  if (!value.startsWith("/")) {
    throw new Error(`${key} must start with /`);
  }

  return value;
}

function normalizeCorsOrigins(config: RawConfig) {
  const nodeEnv = readString(config, "NODE_ENV") ?? "development";
  const rawOrigins = readString(config, "APP_CORS_ORIGINS");

  if (!rawOrigins && nodeEnv !== "production") {
    return LOCAL_CORS_ORIGINS.join(",");
  }

  if (!rawOrigins) {
    throw new Error("APP_CORS_ORIGINS is required in production");
  }

  const origins = rawOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error("APP_CORS_ORIGINS must include at least one origin");
  }

  if (nodeEnv === "production" && origins.includes("*")) {
    throw new Error("APP_CORS_ORIGINS cannot include * in production");
  }

  return origins.join(",");
}

export function validateAppConfig(config: RawConfig) {
  return {
    ...config,
    APP_PORT: requirePort(config, "APP_PORT"),
    APP_IP: requireString(config, "APP_IP"),
    APP_CORS_ORIGINS: normalizeCorsOrigins(config),
    MEDIA_UPLOAD_ROOT: requireString(config, "MEDIA_UPLOAD_ROOT"),
    PUBLIC_UPLOAD_PREFIX: requirePublicPrefix(config, "PUBLIC_UPLOAD_PREFIX"),
  };
}
