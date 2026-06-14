import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MulterModule } from "@nestjs/platform-express";

import { AppConfigService } from "../../common/config/app-config.service";
import { MediaService } from "./media.service";
import { MediaController } from "./media.controller";
import { AccessModule } from "../access/access.module";
import { BusinessModule } from "../business/business.module";
import { PackageModule } from "../packages/package.module";
import { PermissionModule } from "../permissions/permission.module";
import { getMediaLimits } from "./media.config";
import { LocalMediaUploader } from "./uploaders/local-media.uploader";
import { MEDIA_LIMITS } from "./uploaders/media-uploader.constants";
import { MEDIA_UPLOADER } from "./uploaders/media-uploader.constants";

@Module({
  imports: [
    AccessModule,
    BusinessModule,
    PermissionModule,
    PackageModule,
    ConfigModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [AppConfigService],
      useFactory: (appConfig: AppConfigService) => {
        const limits = getMediaLimits(appConfig);

        return {
          limits: {
            fileSize: limits.maxImageSizeBytes,
            files: limits.maxBulkImageFiles,
          },
        };
      },
    }),
  ],
  controllers: [MediaController],
  providers: [
    MediaService,
    LocalMediaUploader,
    {
      provide: MEDIA_LIMITS,
      inject: [AppConfigService],
      useFactory: getMediaLimits,
    },
    {
      provide: MEDIA_UPLOADER,
      useExisting: LocalMediaUploader,
    },
  ],
  exports: [MediaService],
})
export class MediaModule {}
