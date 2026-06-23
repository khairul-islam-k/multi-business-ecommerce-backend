import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

import {
  WebsiteDomainSslStatus,
  WebsiteDomainType,
  WebsiteDomainVerificationStatus,
  WebsiteStatus,
  WebsiteTemplate,
} from "@/database/schema";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";

export class WebsiteConfigDto {
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  headerConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  footerConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  navigationConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  sectionConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  generalConfig?: Record<string, unknown>;
}

export class WebsiteThemeDto {
  @ApiPropertyOptional({ example: "#111827" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  primaryColor?: string;

  @ApiPropertyOptional({ example: "#f8fafc" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  secondaryColor?: string;

  @ApiPropertyOptional({ example: "#14b8a6" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  accentColor?: string;

  @ApiPropertyOptional({ example: "Inter" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fontFamily?: string;

  @ApiPropertyOptional({ example: "/uploads/media/logo.png" })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: "/uploads/media/favicon.png" })
  @IsOptional()
  @IsString()
  faviconUrl?: string;

  @ApiPropertyOptional({ example: ".hero { min-height: 70vh; }" })
  @IsOptional()
  @IsString()
  customCss?: string;
}

export class WebsiteSeoDto {
  @ApiPropertyOptional({ example: "Acme Store" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  metaTitle?: string;

  @ApiPropertyOptional({ example: "Shop Acme products online" })
  @IsOptional()
  @IsString()
  metaDescription?: string;

  @ApiPropertyOptional({ example: "acme,shop,ecommerce" })
  @IsOptional()
  @IsString()
  metaKeywords?: string;

  @ApiPropertyOptional({ example: "Acme Store" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  ogTitle?: string;

  @ApiPropertyOptional({ example: "Shop Acme products online" })
  @IsOptional()
  @IsString()
  ogDescription?: string;

  @ApiPropertyOptional({ example: "/uploads/media/og.png" })
  @IsOptional()
  @IsString()
  ogImageUrl?: string;

  @ApiPropertyOptional({ example: "https://shop.example.com" })
  @IsOptional()
  @IsString()
  canonicalUrl?: string;
}

export class CreateWebsiteDto {
  @ApiPropertyOptional({
    enum: WebsiteTemplate,
    example: WebsiteTemplate.FASHION,
  })
  @IsOptional()
  @IsEnum(WebsiteTemplate)
  template?: WebsiteTemplate;

  @ApiPropertyOptional({ type: WebsiteConfigDto })
  @IsOptional()
  @Type(() => WebsiteConfigDto)
  config?: WebsiteConfigDto;

  @ApiPropertyOptional({ type: WebsiteThemeDto })
  @IsOptional()
  @Type(() => WebsiteThemeDto)
  theme?: WebsiteThemeDto;

  @ApiPropertyOptional({ type: WebsiteSeoDto })
  @IsOptional()
  @Type(() => WebsiteSeoDto)
  seo?: WebsiteSeoDto;
}

export class UpdateWebsiteDto extends PartialType(CreateWebsiteDto) {
  @ApiPropertyOptional({ enum: WebsiteStatus })
  @IsOptional()
  @IsEnum(WebsiteStatus)
  status?: WebsiteStatus;
}

export class UpdateWebsiteConfigDto {
  @ApiPropertyOptional({ type: WebsiteConfigDto })
  @IsOptional()
  @Type(() => WebsiteConfigDto)
  config?: WebsiteConfigDto;

  @ApiPropertyOptional({ type: WebsiteThemeDto })
  @IsOptional()
  @Type(() => WebsiteThemeDto)
  theme?: WebsiteThemeDto;

  @ApiPropertyOptional({ type: WebsiteSeoDto })
  @IsOptional()
  @Type(() => WebsiteSeoDto)
  seo?: WebsiteSeoDto;
}

export class QueryWebsiteDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ enum: WebsiteStatus })
  @IsOptional()
  @IsEnum(WebsiteStatus)
  status?: WebsiteStatus;

  @ApiPropertyOptional({ example: "store" })
  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateWebsiteDomainDto {
  @ApiProperty({ enum: WebsiteDomainType })
  @IsEnum(WebsiteDomainType)
  domainType!: WebsiteDomainType;

  @ApiPropertyOptional({ example: "shop.example.com" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  domain?: string;

  @ApiPropertyOptional({ example: "acme" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  subdomain?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ enum: WebsiteDomainVerificationStatus })
  @IsOptional()
  @IsEnum(WebsiteDomainVerificationStatus)
  verificationStatus?: WebsiteDomainVerificationStatus;

  @ApiPropertyOptional({ enum: WebsiteDomainSslStatus })
  @IsOptional()
  @IsEnum(WebsiteDomainSslStatus)
  sslStatus?: WebsiteDomainSslStatus;
}
