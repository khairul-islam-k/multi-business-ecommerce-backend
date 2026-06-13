import { AppConfigService } from "../../common/config/app-config.service";

export type MediaLimits = {
  maxBulkImageFiles: number;
  maxBulkDeleteImages: number;
  maxImageSizeBytes: number;
};

export const getMediaLimits = (appConfig: AppConfigService): MediaLimits =>
  appConfig.mediaLimits;
