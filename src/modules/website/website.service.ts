import { and, count, desc, eq, ilike, isNull, max, or } from "drizzle-orm";

import {
  business,
  JsonValue,
  website,
  websiteConfig,
  websiteDomain,
  WebsiteDomainSslStatus,
  WebsiteDomainType,
  WebsiteDomainVerificationStatus,
  websitePublishVersion,
  websiteSeoSetting,
  WebsiteStatus,
  WebsiteTemplate,
  websiteThemeSetting,
} from "@/database/schema";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { isUniqueConstraintError } from "../../common/database/db-error.util";
import {
  apiResponse,
  paginatedResponse,
} from "../../common/utils/api-response.util";
import {
  generateRandomSlug,
  slugify,
} from "../../common/utils/slug-generator.util";
import { DatabaseService } from "../../database/database.service";
import {
  CreateWebsiteDomainDto,
  CreateWebsiteDto,
  QueryWebsiteDto,
  UpdateWebsiteConfigDto,
  UpdateWebsiteDto,
} from "./dto/website.dto";

import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";

const WEBSITE_SLUG_MAX_LENGTH = 180;
const WEBSITE_SLUG_RETRY_LIMIT = 5;
const WEBSITE_SUBDOMAIN_MAX_LENGTH = 255;

@Injectable()
export class WebsiteService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  listTemplates() {
    return apiResponse(
      Object.values(WebsiteTemplate).map((key) => ({
        key,
        name: this.toTemplateName(key),
      })),
    );
  }

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreateWebsiteDto,
  ) {
    const businessRow = await this.getBusinessOrThrow(businessId);
    await this.assertBusinessHasNoWebsite(businessId);

    const slug = await this.generateUniqueSlug(businessRow.name);
    const subdomain = await this.generateUniqueSubdomain(businessRow.name);

    try {
      const created = await this.db.transaction(async (tx) => {
        const [item] = await tx
          .insert(website)
          .values({
            businessId,
            name: businessRow.name,
            slug,
            status: WebsiteStatus.DRAFT,
            template: dto.template,
            createdBy: currentUser.id,
            updatedBy: currentUser.id,
          })
          .returning();

        await tx.insert(websiteDomain).values({
          websiteId: item.id,
          domain: null,
          subdomain,
          domainType: WebsiteDomainType.SUBDOMAIN,
          isPrimary: true,
          verificationStatus: WebsiteDomainVerificationStatus.VERIFIED,
          sslStatus: WebsiteDomainSslStatus.ACTIVE,
          verifiedAt: new Date(),
        });

        await tx.insert(websiteConfig).values({
          websiteId: item.id,
          headerConfig: (dto.config?.headerConfig ?? null) as JsonValue,
          footerConfig: (dto.config?.footerConfig ?? null) as JsonValue,
          navigationConfig: (dto.config?.navigationConfig ?? null) as JsonValue,
          sectionConfig: (dto.config?.sectionConfig ?? null) as JsonValue,
          generalConfig: (dto.config?.generalConfig ?? null) as JsonValue,
        });

        await tx.insert(websiteThemeSetting).values({
          websiteId: item.id,
          ...this.buildThemeValues(dto.theme),
        });

        await tx.insert(websiteSeoSetting).values({
          websiteId: item.id,
          ...this.buildSeoValues(dto.seo),
        });

        return item;
      });

      return apiResponse(
        await this.findWebsiteDetails(businessId, created.id),
        "Website was created successfully. A draft website, default verified subdomain, configuration, theme settings, and SEO settings were saved for this business.",
      );
    } catch (error) {
      this.handleUniqueError(
        error,
        "Website already exists for this business or slug already exists",
      );
    }
  }

  async findAll(businessId: string, query: QueryWebsiteDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();
    const where = and(
      eq(website.businessId, businessId),
      isNull(website.deletedAt),
      query.status ? eq(website.status, query.status) : undefined,
      search
        ? or(
            ilike(website.name, `%${search}%`),
            ilike(website.slug, `%${search}%`),
          )
        : undefined,
    );

    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(website)
        .where(where)
        .orderBy(desc(website.createdAt))
        .limit(limit)
        .offset(skip)
        .then((items) =>
          Promise.all(items.map((item) => this.hydrateWebsite(item))),
        ),
      this.db
        .select({ value: count() })
        .from(website)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(
      rows,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      "Websites were loaded successfully. The response includes the requested page of websites for this business and pagination metadata for browsing more results.",
    );
  }

  async findOne(businessId: string, websiteId: string) {
    return apiResponse(await this.findWebsiteDetails(businessId, websiteId));
  }

  async update(
    currentUser: CurrentUserPayload,
    businessId: string,
    websiteId: string,
    dto: UpdateWebsiteDto,
  ) {
    await this.getWebsiteOrThrow(businessId, websiteId);

    try {
      await this.db.transaction(async (tx) => {
        if (dto.config) {
          const configValues = {
            ...(dto.config.headerConfig !== undefined && {
              headerConfig: dto.config.headerConfig as JsonValue,
            }),
            ...(dto.config.footerConfig !== undefined && {
              footerConfig: dto.config.footerConfig as JsonValue,
            }),
            ...(dto.config.navigationConfig !== undefined && {
              navigationConfig: dto.config.navigationConfig as JsonValue,
            }),
            ...(dto.config.sectionConfig !== undefined && {
              sectionConfig: dto.config.sectionConfig as JsonValue,
            }),
            ...(dto.config.generalConfig !== undefined && {
              generalConfig: dto.config.generalConfig as JsonValue,
            }),
          };

          if (this.hasFields(configValues)) {
            await tx
              .insert(websiteConfig)
              .values({
                websiteId,
                ...configValues,
              })
              .onConflictDoUpdate({
                target: websiteConfig.websiteId,
                set: configValues,
              });
          }
        }

        if (dto.theme) {
          const themeValues = this.buildThemeValues(dto.theme);

          if (this.hasFields(themeValues)) {
            await tx
              .insert(websiteThemeSetting)
              .values({ websiteId, ...themeValues })
              .onConflictDoUpdate({
                target: websiteThemeSetting.websiteId,
                set: themeValues,
              });
          }
        }

        if (dto.seo) {
          const seoValues = this.buildSeoValues(dto.seo);

          if (this.hasFields(seoValues)) {
            await tx
              .insert(websiteSeoSetting)
              .values({ websiteId, ...seoValues })
              .onConflictDoUpdate({
                target: websiteSeoSetting.websiteId,
                set: seoValues,
              });
          }
        }

        await tx
          .update(website)
          .set({
            ...(dto.template !== undefined && { template: dto.template }),
            ...(dto.status !== undefined && { status: dto.status }),
            updatedBy: currentUser.id,
          })
          .where(eq(website.id, websiteId))
          .returning();
      });
      return apiResponse(
        await this.findWebsiteDetails(businessId, websiteId),
        "Website was updated successfully. The latest website details, configuration, theme, SEO settings, domains, and publish state are included in the response.",
      );
    } catch (error) {
      this.handleUniqueError(
        error,
        "Website slug already exists. Please choose a different slug or retry after changing the website name.",
      );
    }
  }

  async updateConfig(
    currentUser: CurrentUserPayload,
    businessId: string,
    websiteId: string,
    dto: UpdateWebsiteConfigDto,
  ) {
    await this.getWebsiteOrThrow(businessId, websiteId);

    await this.db.transaction(async (tx) => {
      if (dto.config) {
        const configValues = {
          ...(dto.config.headerConfig !== undefined && {
            headerConfig: dto.config.headerConfig as JsonValue,
          }),
          ...(dto.config.footerConfig !== undefined && {
            footerConfig: dto.config.footerConfig as JsonValue,
          }),
          ...(dto.config.navigationConfig !== undefined && {
            navigationConfig: dto.config.navigationConfig as JsonValue,
          }),
          ...(dto.config.sectionConfig !== undefined && {
            sectionConfig: dto.config.sectionConfig as JsonValue,
          }),
          ...(dto.config.generalConfig !== undefined && {
            generalConfig: dto.config.generalConfig as JsonValue,
          }),
        };

        if (this.hasFields(configValues)) {
          await tx
            .insert(websiteConfig)
            .values({
              websiteId,
              ...configValues,
            })
            .onConflictDoUpdate({
              target: websiteConfig.websiteId,
              set: configValues,
            });
        }
      }

      if (dto.theme) {
        const themeValues = this.buildThemeValues(dto.theme);

        if (this.hasFields(themeValues)) {
          await tx
            .insert(websiteThemeSetting)
            .values({ websiteId, ...themeValues })
            .onConflictDoUpdate({
              target: websiteThemeSetting.websiteId,
              set: themeValues,
            });
        }
      }

      if (dto.seo) {
        const seoValues = this.buildSeoValues(dto.seo);

        if (this.hasFields(seoValues)) {
          await tx
            .insert(websiteSeoSetting)
            .values({ websiteId, ...seoValues })
            .onConflictDoUpdate({
              target: websiteSeoSetting.websiteId,
              set: seoValues,
            });
        }
      }

      await tx
        .update(website)
        .set({ updatedBy: currentUser.id })
        .where(eq(website.id, websiteId));
    });

    return apiResponse(
      await this.findWebsiteDetails(businessId, websiteId),
      "Website configuration was updated successfully. The saved response includes the latest configuration, theme settings, SEO settings, domains, and publish state.",
    );
  }

  async addDomain(
    businessId: string,
    websiteId: string,
    dto: CreateWebsiteDomainDto,
  ) {
    await this.getWebsiteOrThrow(businessId, websiteId);
    this.assertDomainInput(dto);
    await this.assertDomainAvailable(dto);

    try {
      const domainRow = await this.db.transaction(async (tx) => {
        if (dto.isPrimary) {
          await tx
            .update(websiteDomain)
            .set({ isPrimary: false })
            .where(eq(websiteDomain.websiteId, websiteId));
        }

        const [created] = await tx
          .insert(websiteDomain)
          .values({
            websiteId,
            domain:
              dto.domainType === WebsiteDomainType.CUSTOM_DOMAIN
                ? this.normalizeHost(dto.domain)
                : null,
            subdomain:
              dto.domainType === WebsiteDomainType.SUBDOMAIN
                ? this.normalizeHost(dto.subdomain)
                : null,
            domainType: dto.domainType,
            isPrimary: dto.isPrimary ?? false,
            verificationStatus:
              dto.verificationStatus ?? WebsiteDomainVerificationStatus.PENDING,
            sslStatus: dto.sslStatus ?? WebsiteDomainSslStatus.PENDING,
          })
          .returning();

        return created;
      });

      return apiResponse(
        domainRow,
        "Website domain was added successfully. The domain record has been saved; custom domains must still be verified and have active SSL before they can serve storefront traffic.",
      );
    } catch (error) {
      this.handleUniqueError(
        error,
        "Website domain already exists. This domain or subdomain is already registered, so choose another host or update the existing domain record.",
      );
    }
  }

  async publish(
    currentUser: CurrentUserPayload,
    businessId: string,
    websiteId: string,
  ) {
    const details = await this.findWebsiteDetails(businessId, websiteId);
    const nextVersionNo = await this.getNextVersionNo(websiteId);

    const published = await this.db.transaction(async (tx) => {
      const [version] = await tx
        .insert(websitePublishVersion)
        .values({
          websiteId,
          versionNo: nextVersionNo,
          snapshotData: this.toJsonSnapshot(details),
          publishedBy: currentUser.id,
          publishedAt: new Date(),
        })
        .returning();

      const [updated] = await tx
        .update(website)
        .set({
          status: WebsiteStatus.PUBLISHED,
          currentVersionId: version.id,
          updatedBy: currentUser.id,
        })
        .where(eq(website.id, websiteId))
        .returning();

      return updated;
    });

    return apiResponse(
      await this.hydrateWebsite(published),
      "Website was published successfully. A publish version snapshot was created and this website can now serve storefront traffic through verified, SSL-active domains.",
    );
  }

  async unpublish(
    currentUser: CurrentUserPayload,
    businessId: string,
    websiteId: string,
  ) {
    await this.getWebsiteOrThrow(businessId, websiteId);

    const [updated] = await this.db
      .update(website)
      .set({ status: WebsiteStatus.UNPUBLISHED, updatedBy: currentUser.id })
      .where(eq(website.id, websiteId))
      .returning();

    return apiResponse(
      await this.hydrateWebsite(updated),
      "Website was unpublished successfully. Storefront traffic will no longer resolve this website until it is published again.",
    );
  }

  async remove(
    currentUser: CurrentUserPayload,
    businessId: string,
    websiteId: string,
  ) {
    await this.getWebsiteOrThrow(businessId, websiteId);

    await this.db
      .update(website)
      .set({
        status: WebsiteStatus.ARCHIVED,
        deletedAt: new Date(),
        deletedBy: currentUser.id,
        updatedBy: currentUser.id,
      })
      .where(eq(website.id, websiteId));

    return apiResponse(
      null,
      "Website was deleted successfully. It has been archived and soft-deleted, so it will no longer be available for storefront resolution.",
    );
  }

  async findPublishedById(websiteId: string) {
    const [item] = await this.db
      .select()
      .from(website)
      .where(
        and(
          eq(website.id, websiteId),
          eq(website.status, WebsiteStatus.PUBLISHED),
          isNull(website.deletedAt),
        ),
      )
      .limit(1);

    return item ? this.hydrateWebsite(item) : null;
  }

  async findPublishedBySlug(slug: string) {
    const [item] = await this.db
      .select()
      .from(website)
      .where(
        and(
          eq(website.slug, this.normalizeSlug(slug)),
          eq(website.status, WebsiteStatus.PUBLISHED),
          isNull(website.deletedAt),
        ),
      )
      .limit(1);

    return item ? this.hydrateWebsite(item) : null;
  }

  async findPublishedByHost(host: string) {
    const normalizedHost = this.normalizeHost(host);
    if (!normalizedHost) {
      return null;
    }

    const row = await this.findWebsiteHostRow(normalizedHost);

    if (!row || !this.isPublishedDomainReady(row)) {
      return null;
    }

    return row ? this.hydrateWebsite(row.site) : null;
  }

  async findPublishedByHostOrThrow(host?: string | null) {
    const normalizedHost = this.normalizeHost(host ?? "");

    if (!normalizedHost) {
      throw new BadRequestException(
        "A storefront host is required to resolve the published website. Send a valid Host or X-Forwarded-Host header so the API can identify which storefront should handle this request.",
      );
    }

    const row = await this.findWebsiteHostRow(normalizedHost);

    if (!row) {
      throw new NotFoundException(
        `No storefront domain is registered for "${normalizedHost}". Please add this domain or subdomain to the website before using it for storefront requests.`,
      );
    }

    this.assertPublishedDomainReady(row, normalizedHost);

    return this.hydrateWebsite(row.site);
  }

  private async findWebsiteHostRow(host: string) {
    const [row] = await this.db
      .select({ site: website, domain: websiteDomain })
      .from(websiteDomain)
      .innerJoin(website, eq(website.id, websiteDomain.websiteId))
      .where(
        or(eq(websiteDomain.domain, host), eq(websiteDomain.subdomain, host)),
      )
      .limit(1);

    return row ?? null;
  }

  private isPublishedDomainReady(row: {
    site: typeof website.$inferSelect;
    domain: typeof websiteDomain.$inferSelect;
  }) {
    return (
      row.domain.verificationStatus ===
        WebsiteDomainVerificationStatus.VERIFIED &&
      row.domain.sslStatus === WebsiteDomainSslStatus.ACTIVE &&
      row.site.status === WebsiteStatus.PUBLISHED &&
      row.site.deletedAt === null
    );
  }

  private assertPublishedDomainReady(
    row: {
      site: typeof website.$inferSelect;
      domain: typeof websiteDomain.$inferSelect;
    },
    host: string,
  ) {
    if (
      row.domain.verificationStatus !== WebsiteDomainVerificationStatus.VERIFIED
    ) {
      throw new BadRequestException(
        `The storefront domain "${host}" is registered but cannot be used yet because its verification status is ${row.domain.verificationStatus}. Verify the domain ownership first, then retry after the status becomes VERIFIED.`,
      );
    }

    if (row.domain.sslStatus !== WebsiteDomainSslStatus.ACTIVE) {
      throw new BadRequestException(
        `The storefront domain "${host}" is verified but cannot be used yet because its SSL status is ${row.domain.sslStatus}. Activate SSL for this domain first, then retry after the status becomes ACTIVE.`,
      );
    }

    if (row.site.deletedAt !== null) {
      throw new NotFoundException(
        `The storefront domain "${host}" belongs to a website that has been deleted. Restore the website or attach the domain to another published website before using this storefront.`,
      );
    }

    if (row.site.status !== WebsiteStatus.PUBLISHED) {
      throw new BadRequestException(
        `The storefront domain "${host}" belongs to a website whose current status is ${row.site.status}. Publish the website before using this domain for storefront requests.`,
      );
    }
  }

  private async findWebsiteDetails(businessId: string, websiteId: string) {
    const item = await this.getWebsiteOrThrow(businessId, websiteId);

    return this.hydrateWebsite(item);
  }

  private async hydrateWebsite(item: typeof website.$inferSelect) {
    const [config, theme, seo, domains, businessRow, currentVersion] =
      await Promise.all([
        this.db
          .select()
          .from(websiteConfig)
          .where(eq(websiteConfig.websiteId, item.id))
          .then(([row]) => row ?? null),
        this.db
          .select()
          .from(websiteThemeSetting)
          .where(eq(websiteThemeSetting.websiteId, item.id))
          .then(([row]) => row ?? null),
        this.db
          .select()
          .from(websiteSeoSetting)
          .where(eq(websiteSeoSetting.websiteId, item.id))
          .then(([row]) => row ?? null),
        this.db
          .select()
          .from(websiteDomain)
          .where(eq(websiteDomain.websiteId, item.id)),
        this.db
          .select()
          .from(business)
          .where(eq(business.id, item.businessId))
          .then(([row]) => row ?? null),
        item.currentVersionId
          ? this.db
              .select()
              .from(websitePublishVersion)
              .where(eq(websitePublishVersion.id, item.currentVersionId))
              .then(([row]) => row ?? null)
          : Promise.resolve(null),
      ]);

    return {
      ...item,
      business: businessRow,
      config,
      theme,
      seo,
      domains,
      currentVersion,
    };
  }

  private async getWebsiteOrThrow(businessId: string, websiteId: string) {
    const [item] = await this.db
      .select()
      .from(website)
      .where(
        and(
          eq(website.id, websiteId),
          eq(website.businessId, businessId),
          isNull(website.deletedAt),
        ),
      )
      .limit(1);

    if (!item) {
      throw new NotFoundException(
        "Website could not be found. It may not exist, may have been deleted, or may not belong to the requested business.",
      );
    }

    return item;
  }

  private async getBusinessOrThrow(businessId: string) {
    const [businessRow] = await this.db
      .select()
      .from(business)
      .where(and(eq(business.id, businessId), isNull(business.deletedAt)))
      .limit(1);

    if (!businessRow) {
      throw new NotFoundException(
        "Business could not be found. It may not exist, may have been deleted, or may not be accessible to the current user.",
      );
    }

    return businessRow;
  }

  private async assertBusinessHasNoWebsite(businessId: string) {
    const [existing] = await this.db
      .select({ id: website.id })
      .from(website)
      .where(and(eq(website.businessId, businessId), isNull(website.deletedAt)))
      .limit(1);

    if (existing) {
      throw new BadRequestException(
        "A website already exists for this business. Each business can only have one active website, so update or delete the existing website before creating another one.",
      );
    }
  }

  private async generateUniqueSlug(name: string) {
    for (let attempt = 0; attempt < WEBSITE_SLUG_RETRY_LIMIT; attempt++) {
      const slug = generateRandomSlug(name, {
        fallback: "website",
        maxLength: WEBSITE_SLUG_MAX_LENGTH,
      });
      const [existing] = await this.db
        .select({ id: website.id })
        .from(website)
        .where(and(eq(website.slug, slug), isNull(website.deletedAt)))
        .limit(1);

      if (!existing) {
        return slug;
      }
    }

    throw new BadRequestException("Could not generate a unique website slug");
  }

  private async generateUniqueSubdomain(name: string) {
    const base = slugify(name, {
      fallback: "store",
      maxLength: WEBSITE_SUBDOMAIN_MAX_LENGTH,
    });

    for (let attempt = 1; attempt <= WEBSITE_SUBDOMAIN_MAX_LENGTH; attempt++) {
      const suffix = attempt === 1 ? "" : `-${attempt}`;
      const candidateBaseMaxLength = Math.max(
        1,
        WEBSITE_SUBDOMAIN_MAX_LENGTH - suffix.length,
      );
      const candidate = `${base.slice(0, candidateBaseMaxLength).replace(/-+$/g, "")}${suffix}`;

      const [existing] = await this.db
        .select({ id: websiteDomain.id })
        .from(websiteDomain)
        .where(eq(websiteDomain.subdomain, candidate))
        .limit(1);

      if (!existing) {
        return candidate;
      }
    }

    throw new BadRequestException(
      "Could not generate a unique website subdomain",
    );
  }

  private async getNextVersionNo(websiteId: string) {
    const [row] = await this.db
      .select({ value: max(websitePublishVersion.versionNo) })
      .from(websitePublishVersion)
      .where(eq(websitePublishVersion.websiteId, websiteId));

    return (row?.value ?? 0) + 1;
  }

  private normalizeSlug(value: string) {
    return slugify(value, {
      fallback: "website",
      maxLength: WEBSITE_SLUG_MAX_LENGTH,
    });
  }

  private normalizeHost(value?: string | null) {
    return (
      value
        ?.split(",")[0]
        ?.trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "")
        .replace(/:\d+$/, "") || ""
    );
  }

  private assertDomainInput(dto: CreateWebsiteDomainDto) {
    if (
      dto.domainType === WebsiteDomainType.CUSTOM_DOMAIN &&
      !this.normalizeHost(dto.domain)
    ) {
      throw new BadRequestException(
        "Custom domain is required. Provide a valid custom domain when the domain type is CUSTOM_DOMAIN.",
      );
    }

    if (
      dto.domainType === WebsiteDomainType.SUBDOMAIN &&
      !this.normalizeHost(dto.subdomain)
    ) {
      throw new BadRequestException(
        "Subdomain is required. Provide a valid subdomain when the domain type is SUBDOMAIN.",
      );
    }
  }

  private async assertDomainAvailable(dto: CreateWebsiteDomainDto) {
    const normalizedHost =
      dto.domainType === WebsiteDomainType.CUSTOM_DOMAIN
        ? this.normalizeHost(dto.domain)
        : this.normalizeHost(dto.subdomain);

    const [existing] = await this.db
      .select({ id: websiteDomain.id })
      .from(websiteDomain)
      .where(
        or(
          eq(websiteDomain.domain, normalizedHost),
          eq(websiteDomain.subdomain, normalizedHost),
        ),
      )
      .limit(1);

    if (existing) {
      throw new BadRequestException(
        "Website domain already exists. This domain or subdomain is already registered, so choose another host or update the existing domain record.",
      );
    }
  }

  private buildThemeValues(theme?: CreateWebsiteDto["theme"]) {
    return {
      ...(theme?.primaryColor !== undefined && {
        primaryColor: this.normalizeNullableText(theme.primaryColor),
      }),
      ...(theme?.secondaryColor !== undefined && {
        secondaryColor: this.normalizeNullableText(theme.secondaryColor),
      }),
      ...(theme?.accentColor !== undefined && {
        accentColor: this.normalizeNullableText(theme.accentColor),
      }),
      ...(theme?.fontFamily !== undefined && {
        fontFamily: this.normalizeNullableText(theme.fontFamily),
      }),
      ...(theme?.logoUrl !== undefined && {
        logoUrl: this.normalizeNullableText(theme.logoUrl),
      }),
      ...(theme?.faviconUrl !== undefined && {
        faviconUrl: this.normalizeNullableText(theme.faviconUrl),
      }),
      ...(theme?.customCss !== undefined && {
        customCss: this.normalizeNullableText(theme.customCss),
      }),
    };
  }

  private buildSeoValues(seo?: CreateWebsiteDto["seo"]) {
    return {
      ...(seo?.metaTitle !== undefined && {
        metaTitle: this.normalizeNullableText(seo.metaTitle),
      }),
      ...(seo?.metaDescription !== undefined && {
        metaDescription: this.normalizeNullableText(seo.metaDescription),
      }),
      ...(seo?.metaKeywords !== undefined && {
        metaKeywords: this.normalizeNullableText(seo.metaKeywords),
      }),
      ...(seo?.ogTitle !== undefined && {
        ogTitle: this.normalizeNullableText(seo.ogTitle),
      }),
      ...(seo?.ogDescription !== undefined && {
        ogDescription: this.normalizeNullableText(seo.ogDescription),
      }),
      ...(seo?.ogImageUrl !== undefined && {
        ogImageUrl: this.normalizeNullableText(seo.ogImageUrl),
      }),
      ...(seo?.canonicalUrl !== undefined && {
        canonicalUrl: this.normalizeNullableText(seo.canonicalUrl),
      }),
    };
  }

  private normalizeNullableText(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }

    const normalized = value?.trim();

    return normalized || null;
  }

  private hasFields(value: object) {
    return Object.keys(value).length > 0;
  }

  private toTemplateName(template: WebsiteTemplate) {
    return template
      .toLowerCase()
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  private toJsonSnapshot(value: unknown) {
    return JSON.parse(JSON.stringify(value)) as JsonValue;
  }

  private handleUniqueError(error: unknown, message: string): never {
    if (isUniqueConstraintError(error)) {
      throw new BadRequestException(message);
    }

    throw error;
  }
}
