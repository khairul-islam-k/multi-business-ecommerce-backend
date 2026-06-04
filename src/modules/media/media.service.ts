import {
  BadRequestException,
  Inject,
  Injectable,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import {
  MediaAssetStatus,
  MediaFileType,
  MediaTagStatus,
  PackageLimitKey,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import {
  apiResponse,
  paginatedResponse,
} from "../../common/utils/api-response.util";
import { QueryMediaDto } from "./dto/query-media.dto";
import { UploadMediaDto } from "./dto/upload-media.dto";
import { DeleteMediaBulkDto } from "./dto/delete-media.dto";
import {
  MEDIA_LIMITS,
  MEDIA_UPLOADER,
} from "./uploaders/media-uploader.constants";
import type { MediaLimits } from "./media.config";
import type {
  MediaUploader,
  UploadableMediaFile,
} from "./uploaders/media-uploader.types";
import { PackageLimitService } from "../packages/package-limit.service";

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MEDIA_ASSET_INCLUDE = {
  tags: {
    include: {
      tag: true,
    },
    orderBy: {
      tag: {
        name: "asc",
      },
    },
  },
} satisfies Prisma.MediaAssetInclude;

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MEDIA_UPLOADER)
    private readonly uploader: MediaUploader,
    @Inject(MEDIA_LIMITS)
    private readonly limits: MediaLimits,
    private readonly packageLimits: PackageLimitService,
  ) {}

  async uploadImage(
    currentUser: CurrentUserPayload,
    businessId: string,
    file: UploadableMediaFile | undefined,
    dto: UploadMediaDto,
  ) {
    this.assertValidImage(file);
    await this.packageLimits.assertWithinLimit(
      currentUser,
      PackageLimitKey.MAX_MEDIAS,
    );

    const tags = this.normalizeTags(dto.tags);
    const uploadedFile = await this.uploader.upload(file, {
      businessId,
    });

    const asset = await this.createImageAsset({
      businessId,
      uploadedBy: currentUser.id,
      uploadedFile,
      altText: dto.altText,
      tags,
    });

    return apiResponse(asset, "Image uploaded successfully");
  }

  async uploadImages(
    currentUser: CurrentUserPayload,
    businessId: string,
    files: UploadableMediaFile[] | undefined,
    dto: UploadMediaDto,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException("At least one image file is required");
    }

    if (files.length > this.limits.maxBulkImageFiles) {
      throw new BadRequestException(
        `You can upload up to ${this.limits.maxBulkImageFiles} images at once`,
      );
    }

    await this.packageLimits.assertWithinLimit(
      currentUser,
      PackageLimitKey.MAX_MEDIAS,
      files.length,
    );

    for (const file of files) {
      this.assertValidImage(file);
    }

    const tags = this.normalizeTags(dto.tags);
    const assets: Prisma.MediaAssetGetPayload<{
      include: typeof MEDIA_ASSET_INCLUDE;
    }>[] = [];

    for (const file of files) {
      const uploadedFile = await this.uploader.upload(file, {
        businessId,
      });

      const asset = await this.createImageAsset({
        businessId,
        uploadedBy: currentUser.id,
        uploadedFile,
        altText: dto.altText,
        tags,
      });

      assets.push(asset);
    }

    return apiResponse(assets, "Images uploaded successfully");
  }

  async findImages(businessId: string, query: QueryMediaDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const tags = this.normalizeTags(query.tags);

    const where: Prisma.MediaAssetWhereInput = {
      businessId,
      fileType: MediaFileType.IMAGE,
      status: MediaAssetStatus.ACTIVE,
      deletedAt: null,
      ...(tags.length > 0 && {
        tags: {
          some: {
            tag: {
              businessId,
              status: MediaTagStatus.ACTIVE,
              name: {
                in: tags,
                mode: "insensitive",
              },
            },
          },
        },
      }),
    };

    const orderBy: Prisma.MediaAssetOrderByWithRelationInput = {
      [query.sortBy ?? "createdAt"]: query.sortOrder ?? "desc",
    };

    const [items, total] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: MEDIA_ASSET_INCLUDE,
      }),
      this.prisma.mediaAsset.count({
        where,
      }),
    ]);

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async deleteImage(businessId: string, mediaAssetId: string) {
    const asset = await this.getActiveImageAssetOrThrow(
      businessId,
      mediaAssetId,
    );

    await this.softDeleteImageAssets([asset.id]);
    await this.uploader.delete(asset.fileUrl);

    return apiResponse(null, "Image deleted successfully");
  }

  async deleteImages(businessId: string, dto: DeleteMediaBulkDto) {
    if (dto.mediaAssetIds.length > this.limits.maxBulkDeleteImages) {
      throw new BadRequestException(
        `You can delete up to ${this.limits.maxBulkDeleteImages} images at once`,
      );
    }

    const assets = await this.getActiveImageAssetsOrThrow(
      businessId,
      dto.mediaAssetIds,
    );

    await this.softDeleteImageAssets(assets.map((asset) => asset.id));

    await Promise.all(
      assets.map((asset) => this.uploader.delete(asset.fileUrl)),
    );

    return apiResponse(
      {
        deletedCount: assets.length,
      },
      "Images deleted successfully",
    );
  }

  private assertValidImage(
    file: UploadableMediaFile | undefined,
  ): asserts file is UploadableMediaFile {
    if (!file) {
      throw new BadRequestException("Image file is required");
    }

    if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
      throw new BadRequestException("Image file buffer is missing");
    }

    if (file.size === 0 || file.buffer.length === 0) {
      throw new BadRequestException("Image file is empty");
    }

    if (!SUPPORTED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      throw new UnsupportedMediaTypeException("Unsupported image type");
    }
  }

  private async getActiveImageAssetOrThrow(
    businessId: string,
    mediaAssetId: string,
  ) {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: this.getActiveImageWhere(businessId, [mediaAssetId]),
      select: {
        id: true,
        fileUrl: true,
      },
    });

    if (!asset) {
      throw new BadRequestException("Image not found");
    }

    return asset;
  }

  private async getActiveImageAssetsOrThrow(
    businessId: string,
    mediaAssetIds: string[],
  ) {
    const uniqueMediaAssetIds = [...new Set(mediaAssetIds)];

    const assets = await this.prisma.mediaAsset.findMany({
      where: this.getActiveImageWhere(businessId, uniqueMediaAssetIds),
      select: {
        id: true,
        fileUrl: true,
      },
    });

    if (assets.length !== uniqueMediaAssetIds.length) {
      throw new BadRequestException("One or more images were not found");
    }

    return assets;
  }

  private getActiveImageWhere(
    businessId: string,
    mediaAssetIds: string[],
  ): Prisma.MediaAssetWhereInput {
    return {
      id: {
        in: mediaAssetIds,
      },
      businessId,
      fileType: MediaFileType.IMAGE,
      status: MediaAssetStatus.ACTIVE,
      deletedAt: null,
    };
  }

  private async softDeleteImageAssets(mediaAssetIds: string[]) {
    await this.prisma.mediaAsset.updateMany({
      where: {
        id: {
          in: mediaAssetIds,
        },
      },
      data: {
        status: MediaAssetStatus.INACTIVE,
        deletedAt: new Date(),
      },
    });
  }

  private async createImageAsset(params: {
    businessId: string;
    uploadedBy: string;
    uploadedFile: {
      fileName: string;
      fileUrl: string;
      mimeType: string;
      fileSize: number;
    };
    altText?: string;
    tags: string[];
  }) {
    return this.prisma.mediaAsset.create({
      data: {
        businessId: params.businessId,
        uploadedBy: params.uploadedBy,
        fileName: params.uploadedFile.fileName,
        fileUrl: params.uploadedFile.fileUrl,
        fileType: MediaFileType.IMAGE,
        mimeType: params.uploadedFile.mimeType,
        fileSize: params.uploadedFile.fileSize,
        altText: this.normalizeNullableText(params.altText),
        tags: {
          create: params.tags.map((tag) => ({
            tag: {
              connectOrCreate: {
                where: {
                  businessId_name: {
                    businessId: params.businessId,
                    name: tag,
                  },
                },
                create: {
                  businessId: params.businessId,
                  name: tag,
                  status: MediaTagStatus.ACTIVE,
                },
              },
            },
          })),
        },
      },
      include: MEDIA_ASSET_INCLUDE,
    });
  }

  private normalizeTags(value?: string) {
    if (!value) {
      return [];
    }

    return [
      ...new Set(
        value
          .split(",")
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean),
      ),
    ].slice(0, 20);
  }

  private normalizeNullableText(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }

    const normalizedValue = value?.trim();

    return normalizedValue || null;
  }
}
