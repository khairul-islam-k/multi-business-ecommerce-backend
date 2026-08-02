import { Injectable } from "@nestjs/common";

import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { extname, join, normalize, relative } from "node:path";

import { optimizeImage } from "./optimizer";
import { AppConfigService } from "../../../common/config/app-config.service";
import {
  MediaUploader,
  UploadableMediaFile,
  UploadMediaOptions,
  UploadedMediaFile,
} from "./media-uploader.types";

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
};

@Injectable()
export class LocalMediaUploader implements MediaUploader {
  private readonly uploadRoot: string;
  private readonly publicUploadPrefix: string;

  constructor(appConfig: AppConfigService) {
    this.uploadRoot = appConfig.mediaUploadRoot;
    this.publicUploadPrefix = appConfig.publicUploadPrefix;
  }

  async upload(
    file: UploadableMediaFile,
    options: UploadMediaOptions,
  ): Promise<UploadedMediaFile> {
    const optimized = await optimizeImage(file.buffer, {
      format: "webp",
    });

    const extension = this.resolveExtension(file);
    const fileName = `${randomUUID()}${extension}`;
    const relativeDirectory = join("media", options.businessId);
    const absoluteDirectory = join(
      process.cwd(),
      this.uploadRoot,
      relativeDirectory,
    );
    const absolutePath = join(absoluteDirectory, fileName);

    await mkdir(absoluteDirectory, {
      recursive: true,
    });

    await writeFile(absolutePath, optimized.buffer);

    return {
      fileName: file.originalname,
      fileUrl: this.toPublicUrl(relativeDirectory, fileName),
      mimeType: optimized.format,
      fileSize: optimized.size,
    };
  }

  async delete(fileUrl: string) {
    const publicPrefix = this.publicUploadPrefix.endsWith("/")
      ? this.publicUploadPrefix
      : `${this.publicUploadPrefix}/`;

    if (!fileUrl.startsWith(publicPrefix)) {
      return;
    }

    const relativePath = fileUrl.slice(publicPrefix.length);
    const uploadRootPath = join(process.cwd(), this.uploadRoot);
    const absolutePath = normalize(join(uploadRootPath, relativePath));
    const pathFromUploadRoot = relative(uploadRootPath, absolutePath);

    if (pathFromUploadRoot.startsWith("..") || pathFromUploadRoot === "") {
      return;
    }

    await rm(absolutePath, {
      force: true,
    });
  }

  private resolveExtension(file: UploadableMediaFile) {
    const extension = extname(file.originalname).toLowerCase();

    return extension || MIME_EXTENSION_MAP[file.mimetype] || "";
  }

  private toPublicUrl(relativeDirectory: string, fileName: string) {
    return `${this.publicUploadPrefix}/${relativeDirectory.replace(/\\/g, "/")}/${fileName}`;
  }
}
