import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { ConfigModule } from "@nestjs/config";

import { AppConfigService } from "../../common/config/app-config.service";
import { MediaService } from "./media.service";
import { MediaController } from "./media.controller";
import { BusinessModule } from "../business/business.module";
import { PermissionModule } from "../permissions/permission.module";
import { PackageModule } from "../packages/package.module";
import { MEDIA_UPLOADER } from "./uploaders/media-uploader.constants";
import { LocalMediaUploader } from "./uploaders/local-media.uploader";
import { getMediaLimits } from "./media.config";
import { MEDIA_LIMITS } from "./uploaders/media-uploader.constants";

@Module({
  imports: [
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
