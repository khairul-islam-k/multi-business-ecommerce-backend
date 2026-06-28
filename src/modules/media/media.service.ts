import {
  BadRequestException,
  Inject,
  Injectable,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import {
  type MediaAsset,
  type MediaAssetTag,
  type MediaTag,
  MediaAssetStatus,
  MediaFileType,
  MediaTagStatus,
  PackageLimitKey,
  mediaAsset,
  mediaAssetTag,
  mediaTag,
  productImage,
} from "@/database/schema";
import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";

import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { DeleteMediaBulkDto } from "./dto/delete-media.dto";
import { MediaSortBy, QueryMediaDto } from "./dto/query-media.dto";
import { UploadMediaDto } from "./dto/upload-media.dto";
import { DatabaseService } from "../../database/database.service";
import { PackageLimitService } from "../packages/package-limit.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../common/utils/api-response.util";
import type { MediaLimits } from "./media.config";
import {
  MEDIA_LIMITS,
  MEDIA_UPLOADER,
} from "./uploaders/media-uploader.constants";
import type {
  MediaUploader,
  UploadableMediaFile,
} from "./uploaders/media-uploader.types";
import { buildOrderBy, resolveSortColumn } from "../../common/http/sort.util";

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type MediaAssetTagWithTag = MediaAssetTag & {
  tag: MediaTag;
};

type MediaAssetWithTags = MediaAsset & {
  tags: MediaAssetTagWithTag[];
};

@Injectable()
export class MediaService {
  constructor(
    private readonly database: DatabaseService,
    @Inject(MEDIA_UPLOADER)
    private readonly uploader: MediaUploader,
    @Inject(MEDIA_LIMITS)
    private readonly limits: MediaLimits,
    private readonly packageLimits: PackageLimitService,
  ) {}

  private get db() {
    return this.database.db;
  }

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
      this.toMegabytes(file.size),
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
      throw new BadRequestException(
        "At least one image file is required. Upload one or more valid image files before retrying this media request.",
      );
    }

    if (files.length > this.limits.maxBulkImageFiles) {
      throw new BadRequestException(
        `You can upload up to ${this.limits.maxBulkImageFiles} images at once`,
      );
    }

    await this.packageLimits.assertWithinLimit(
      currentUser,
      PackageLimitKey.MAX_MEDIAS,
      this.toMegabytes(files.reduce((total, file) => total + file.size, 0)),
    );

    for (const file of files) {
      this.assertValidImage(file);
    }

    const tags = this.normalizeTags(dto.tags);
    const assets: MediaAssetWithTags[] = [];

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
    const where = and(
      eq(mediaAsset.businessId, businessId),
      eq(mediaAsset.fileType, MediaFileType.IMAGE),
      eq(mediaAsset.status, MediaAssetStatus.ACTIVE),
      isNull(mediaAsset.deletedAt),
      tags.length > 0
        ? inArray(
            mediaAsset.id,
            this.db
              .select({ id: mediaAssetTag.mediaAssetId })
              .from(mediaAssetTag)
              .innerJoin(mediaTag, eq(mediaTag.id, mediaAssetTag.tagId))
              .where(
                and(
                  eq(mediaTag.businessId, businessId),
                  eq(mediaTag.status, MediaTagStatus.ACTIVE),
                  inArray(mediaTag.name, tags),
                ),
              ),
          )
        : undefined,
    );

    const [items, total] = await Promise.all([
      this.db
        .select()
        .from(mediaAsset)
        .where(where)
        .orderBy(
          buildOrderBy(
            resolveSortColumn(
              query.sortBy,
              {
                [MediaSortBy.CREATED_AT]: mediaAsset.createdAt,
                [MediaSortBy.FILE_NAME]: mediaAsset.fileName,
                [MediaSortBy.FILE_SIZE]: mediaAsset.fileSize,
              },
              MediaSortBy.CREATED_AT,
            ),
            query.sortOrder,
          ),
        )
        .limit(limit)
        .offset(skip)
        .then((rows) => this.withAssetsTags(rows)),
      this.db
        .select({ value: count() })
        .from(mediaAsset)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(
      items,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Media assets were loaded successfully. The response includes the requested page of images for this business and pagination metadata for browsing more results.",
    );
  }

  async deleteImage(
    currentUser: CurrentUserPayload,
    businessId: string,
    mediaAssetId: string,
  ) {
    const asset = await this.getActiveImageAssetOrThrow(
      businessId,
      mediaAssetId,
    );

    await this.assertImagesAreNotInUse(businessId, [asset.fileUrl]);
    await this.softDeleteImageAssets([asset.id], currentUser.id);
    await this.uploader.delete(asset.fileUrl);

    return apiResponse(
      null,
      "Image was deleted successfully. The media asset was soft-deleted and its file deletion was requested from the configured uploader.",
    );
  }

  async deleteImages(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: DeleteMediaBulkDto,
  ) {
    if (dto.mediaAssetIds.length > this.limits.maxBulkDeleteImages) {
      throw new BadRequestException(
        `You can delete up to ${this.limits.maxBulkDeleteImages} images at once`,
      );
    }

    const assets = await this.getActiveImageAssetsOrThrow(
      businessId,
      dto.mediaAssetIds,
    );

    await this.assertImagesAreNotInUse(
      businessId,
      assets.map((asset) => asset.fileUrl),
    );
    await this.softDeleteImageAssets(
      assets.map((asset) => asset.id),
      currentUser.id,
    );

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
      throw new BadRequestException(
        "Image file is required. Upload a valid image file before retrying this media request.",
      );
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
    const [asset] = await this.db
      .select({
        id: mediaAsset.id,
        fileUrl: mediaAsset.fileUrl,
      })
      .from(mediaAsset)
      .where(this.getActiveImageCondition(businessId, [mediaAssetId]))
      .limit(1);

    if (!asset) {
      throw new BadRequestException(
        "Image could not be found. It may not exist, may have been deleted, or may not belong to the current business.",
      );
    }

    return asset;
  }

  private async getActiveImageAssetsOrThrow(
    businessId: string,
    mediaAssetIds: string[],
  ) {
    const uniqueMediaAssetIds = [...new Set(mediaAssetIds)];

    const assets = await this.db
      .select({
        id: mediaAsset.id,
        fileUrl: mediaAsset.fileUrl,
      })
      .from(mediaAsset)
      .where(this.getActiveImageCondition(businessId, uniqueMediaAssetIds));

    if (assets.length !== uniqueMediaAssetIds.length) {
      throw new BadRequestException("One or more images were not found");
    }

    return assets;
  }

  private async assertImagesAreNotInUse(
    businessId: string,
    imageUrls: string[],
  ) {
    const [{ value }] = await this.db
      .select({ value: count() })
      .from(productImage)
      .where(
        and(
          eq(productImage.businessId, businessId),
          inArray(productImage.imageUrl, imageUrls),
          isNull(productImage.deletedAt),
        ),
      );

    if (value > 0) {
      throw new BadRequestException(
        "Image cannot be deleted while it is used by product media",
      );
    }
  }

  private getActiveImageCondition(businessId: string, mediaAssetIds: string[]) {
    return and(
      inArray(mediaAsset.id, mediaAssetIds),
      eq(mediaAsset.businessId, businessId),
      eq(mediaAsset.fileType, MediaFileType.IMAGE),
      eq(mediaAsset.status, MediaAssetStatus.ACTIVE),
      isNull(mediaAsset.deletedAt),
    );
  }

  private async softDeleteImageAssets(mediaAssetIds: string[], userId: string) {
    await this.db
      .update(mediaAsset)
      .set({
        status: MediaAssetStatus.INACTIVE,
        deletedAt: new Date(),
        deletedBy: userId,
      })
      .where(inArray(mediaAsset.id, mediaAssetIds));
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
    const asset = await this.db.transaction(async (tx) => {
      const [createdAsset] = await tx
        .insert(mediaAsset)
        .values({
          businessId: params.businessId,
          uploadedBy: params.uploadedBy,
          fileName: params.uploadedFile.fileName,
          fileUrl: params.uploadedFile.fileUrl,
          fileType: MediaFileType.IMAGE,
          mimeType: params.uploadedFile.mimeType,
          fileSize: params.uploadedFile.fileSize,
          altText: this.normalizeNullableText(params.altText),
          status: MediaAssetStatus.ACTIVE,
        })
        .returning();

      for (const tag of params.tags) {
        await tx
          .insert(mediaTag)
          .values({
            businessId: params.businessId,
            name: tag,
            status: MediaTagStatus.ACTIVE,
          })
          .onConflictDoNothing();

        const [tagRow] = await tx
          .select({ id: mediaTag.id })
          .from(mediaTag)
          .where(
            and(
              eq(mediaTag.businessId, params.businessId),
              eq(mediaTag.name, tag),
            ),
          )
          .limit(1);

        if (tagRow) {
          await tx
            .insert(mediaAssetTag)
            .values({
              mediaAssetId: createdAsset.id,
              tagId: tagRow.id,
            })
            .onConflictDoNothing();
        }
      }

      return createdAsset;
    });

    return this.withAssetTags(asset);
  }

  private async withAssetsTags(assets: MediaAsset[]) {
    return Promise.all(assets.map((asset) => this.withAssetTags(asset)));
  }

  private async withAssetTags(asset: MediaAsset): Promise<MediaAssetWithTags> {
    const tags = await this.db
      .select({ map: mediaAssetTag, tag: mediaTag })
      .from(mediaAssetTag)
      .innerJoin(mediaTag, eq(mediaTag.id, mediaAssetTag.tagId))
      .where(eq(mediaAssetTag.mediaAssetId, asset.id))
      .orderBy(asc(mediaTag.name));

    return {
      ...asset,
      tags: tags.map((row) => ({
        ...row.map,
        tag: row.tag,
      })),
    };
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

  private toMegabytes(bytes: number) {
    return Math.max(Math.ceil(bytes / 1024 / 1024), 1);
  }
}
