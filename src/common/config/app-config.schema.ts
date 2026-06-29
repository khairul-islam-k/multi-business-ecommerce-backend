import "reflect-metadata";

import { plainToInstance, Type } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  validateSync,
} from "class-validator";

type RawConfig = Record<string, unknown>;

export class EnvironmentVariables {
  @IsOptional()
  @IsIn(["development", "production", "test"])
  NODE_ENV?: string = "development";

  @IsString()
  @IsNotEmpty()
  APP_NAME!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  APP_PORT!: number;

  @IsString()
  @IsNotEmpty()
  APP_IP!: string;

  @IsOptional()
  @IsString()
  APP_PUBLIC_API_URL?: string;

  @IsString()
  @IsNotEmpty()
  APP_CORS_ORIGINS!: string;

  @IsOptional()
  @IsString()
  APP_CORS_SUBDOMAIN_BASES!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(ms|s|m|h|d|w)?$/, {
    message: "JWT_ACCESS_EXPIRES_IN must be a duration like 30m",
  })
  JWT_ACCESS_EXPIRES_IN!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  JWT_REFRESH_EXPIRES_IN_DAYS!: number;

  @IsOptional()
  @IsString()
  SEED_ADMIN_NAME?: string;

  @IsOptional()
  @IsEmail()
  SEED_ADMIN_EMAIL?: string;

  @IsOptional()
  @IsString()
  SEED_ADMIN_PASSWORD?: string;

  @IsString()
  @IsNotEmpty()
  MEDIA_UPLOAD_ROOT!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\//, {
    message: "PUBLIC_UPLOAD_PREFIX must start with /",
  })
  PUBLIC_UPLOAD_PREFIX!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  MEDIA_MAX_IMAGE_SIZE_BYTES!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  MEDIA_MAX_BULK_IMAGE_FILES!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  MEDIA_MAX_BULK_DELETE_IMAGES!: number;

  @IsString()
  @IsNotEmpty()
  MAIL_PASS!: string;

  @IsString()
  @IsNotEmpty()
  MAIL_HOST!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  MAIL_PORT!: number;

  @IsString()
  @IsNotEmpty()
  MAIL_USER!: string;

  @IsString()
  @IsNotEmpty()
  MAIL_FROM!: string;

  @IsString()
  @IsNotEmpty()
  OTP_SECRET!: string;

  @IsOptional()
  @IsString()
  PAYMENT_CONFIG_ENCRYPTION_KEY!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  OTP_MAX_ATTEMPT!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  OTP_EXPIRES_IN_MINS!: number;
}

function normalizeOptionalBlankValues(config: RawConfig) {
  const optionalKeys = [
    "SEED_ADMIN_NAME",
    "SEED_ADMIN_EMAIL",
    "SEED_ADMIN_PASSWORD",
  ];
  const normalizedConfig = { ...config };

  for (const key of optionalKeys) {
    if (normalizedConfig[key] === "") {
      normalizedConfig[key] = undefined;
    }
  }

  return normalizedConfig;
}

function withDefaults(config: RawConfig) {
  const nodeEnv =
    typeof config.NODE_ENV === "string" && config.NODE_ENV.trim()
      ? config.NODE_ENV.trim()
      : "development";
  const appCorsOrigins =
    typeof config.APP_CORS_ORIGINS === "string" &&
    config.APP_CORS_ORIGINS.trim()
      ? config.APP_CORS_ORIGINS
      : undefined;
  const appCorsSubdomainBases =
    typeof config.APP_CORS_SUBDOMAIN_BASES === "string"
      ? config.APP_CORS_SUBDOMAIN_BASES
      : "";

  return normalizeOptionalBlankValues({
    ...config,
    NODE_ENV: nodeEnv,
    APP_CORS_ORIGINS: appCorsOrigins,
    APP_CORS_SUBDOMAIN_BASES: appCorsSubdomainBases,
  });
}

function validateCorsOrigins(config: EnvironmentVariables) {
  const origins = config.APP_CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error("APP_CORS_ORIGINS must include at least one origin");
  }

  if (origins.includes("*")) {
    throw new Error("APP_CORS_ORIGINS cannot include *");
  }

  return origins.join(",");
}

function validateCorsSubdomainBases(config: EnvironmentVariables) {
  const domains = (config.APP_CORS_SUBDOMAIN_BASES ?? "")
    .split(",")
    .map((domain) => domain.trim())
    .filter(Boolean);

  if (domains.includes("*")) {
    throw new Error("APP_CORS_SUBDOMAIN_BASES cannot include *");
  }

  return domains.join(",");
}

function formatValidationErrors(errors: ReturnType<typeof validateSync>) {
  return errors
    .flatMap((error) => Object.values(error.constraints ?? {}))
    .join("; ");
}

export function validateAppConfig(config: RawConfig) {
  const validatedConfig = plainToInstance(
    EnvironmentVariables,
    withDefaults(config),
    {
      enableImplicitConversion: true,
    },
  );
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Invalid application config: ${formatValidationErrors(errors)}`,
    );
  }

  validatedConfig.APP_CORS_ORIGINS = validateCorsOrigins(validatedConfig);
  validatedConfig.APP_CORS_SUBDOMAIN_BASES =
    validateCorsSubdomainBases(validatedConfig);

  return validatedConfig;
}
