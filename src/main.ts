import { NestFactory } from "@nestjs/core";
import { join } from "node:path";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    logger: ["error", "warn", "log", "debug", "verbose"],
  });

  const uploadRoot = process.env.MEDIA_UPLOAD_ROOT!;
  const publicUploadPrefix = process.env.PUBLIC_UPLOAD_PREFIX!;

  app.enableCors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
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

  const port = process.env.APP_PORT!;
  const ip = process.env.APP_IP!;

  await app.listen(port, ip);

  const logger = new Logger("Bootstrap");

  logger.log(`Server running on http://${ip}:${port}/api/v1`);
  logger.log(`Swagger running on http://${ip}:${port}/api/v1/docs`);
}

bootstrap();
