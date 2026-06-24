import "reflect-metadata";

import { join } from "node:path";

import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { and, eq, isNull, or } from "drizzle-orm";

import { AppModule } from "./app.module";
import { AppConfigService } from "./common/config/app-config.service";
import { createCorsOrigin } from "./common/config/cors.config";
import { DatabaseService } from "./database/database.service";
import {
  website,
  websiteDomain,
  WebsiteDomainSslStatus,
  WebsiteDomainVerificationStatus,
  WebsiteStatus,
} from "./database/schema";

const CORS_DOMAIN_CACHE_TTL_MS = 5 * 60 * 1000;

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    logger: ["error", "warn", "log", "debug", "verbose"],
  });

  const appConfig = app.get(AppConfigService);
  const database = app.get(DatabaseService);
  const uploadRoot = appConfig.mediaUploadRoot;
  const publicUploadPrefix = appConfig.publicUploadPrefix;

  app.enableCors({
    origin: createCorsOrigin({
      allowedOrigins: appConfig.corsOrigins,
      allowedSubdomainBases: appConfig.corsSubdomainBases,
      isAllowedCustomDomain: createCustomDomainCorsChecker(database),
    }),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-forwarded-host",
      "host",
    ],
  });

  app.setGlobalPrefix("api/v1");

  app.useStaticAssets(join(process.cwd(), uploadRoot), {
    prefix: publicUploadPrefix,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle("Onecomm")
    .setDescription("Onecomm API")
    .setVersion("1.0")
    .addBearerAuth({
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      name: "Authorization",
      in: "header",
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup("docs", app, document, {
    useGlobalPrefix: true,
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = appConfig.appPort;
  const ip = appConfig.appIp;

  await app.listen(port, ip);

  const logger = new Logger("Bootstrap");

  logger.log(`Server running on http://${ip}:${port}/api/v1`);
  logger.log(`Swagger running on http://${ip}:${port}/api/v1/docs`);
}

void bootstrap();

function createCustomDomainCorsChecker(database: DatabaseService) {
  const cache = new Map<string, { allowed: boolean; expiresAt: number }>();

  return async (hostname: string) => {
    const now = Date.now();
    const cached = cache.get(hostname);

    console.log(hostname, cached);

    if (cached && cached.expiresAt > now) {
      return cached.allowed;
    }

    const [row] = await database.db
      .select({ id: websiteDomain.id })
      .from(websiteDomain)
      .innerJoin(website, eq(website.id, websiteDomain.websiteId))
      .where(
        and(
          or(
            eq(websiteDomain.domain, hostname),
            eq(websiteDomain.subdomain, hostname),
          ),
          eq(
            websiteDomain.verificationStatus,
            WebsiteDomainVerificationStatus.VERIFIED,
          ),
          eq(websiteDomain.sslStatus, WebsiteDomainSslStatus.ACTIVE),
          eq(website.status, WebsiteStatus.PUBLISHED),
          isNull(website.deletedAt),
        ),
      )
      .limit(1);
    const allowed = Boolean(row);

    cache.set(hostname, {
      allowed,
      expiresAt: now + CORS_DOMAIN_CACHE_TTL_MS,
    });

    return allowed;
  };
}
