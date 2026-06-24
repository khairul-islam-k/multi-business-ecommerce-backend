import "reflect-metadata";

import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { join } from "node:path";

import { AppConfigService } from "./common/config/app-config.service";
import { AppModule } from "./app.module";
import { createCorsOrigin } from "./common/config/cors.config";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    logger: ["error", "warn", "log", "debug", "verbose"],
  });

  const appConfig = app.get(AppConfigService);
  const uploadRoot = appConfig.mediaUploadRoot;
  const publicUploadPrefix = appConfig.publicUploadPrefix;

  app.enableCors({
    origin: createCorsOrigin(appConfig.corsOrigins),
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
