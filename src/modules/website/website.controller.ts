import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PermissionAction, RbacFeature } from "@/database/schema";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../business/guards/business.guard";
import { SubscriptionGuard } from "../packages/guards/subscription.guard";
import { PermissionGuard } from "../permissions/guards/permission.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import {
  CreateWebsiteDomainDto,
  CreateWebsiteDto,
  QueryWebsiteDto,
  UpdateWebsiteConfigDto,
  UpdateWebsiteDto,
} from "./dto/website.dto";
import { WebsiteService } from "./website.service";

@ApiTags("Websites")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("websites/businesses/:businessId")
export class WebsiteController {
  constructor(private readonly websites: WebsiteService) {}

  @RequirePermission(RbacFeature.WEBSITE_MANAGEMENT, PermissionAction.READ)
  @Get("templates")
  @ApiOperation({ summary: "Get website templates" })
  listTemplates(@Param("businessId", ParseUUIDPipe) businessId: string) {
    return this.websites.listTemplates();
  }

  @RequirePermission(RbacFeature.WEBSITE_MANAGEMENT, PermissionAction.CREATE)
  @Post()
  @ApiOperation({ summary: "Create website" })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateWebsiteDto,
  ) {
    return this.websites.create(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.WEBSITE_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({ summary: "Get websites" })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryWebsiteDto,
  ) {
    return this.websites.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.WEBSITE_MANAGEMENT, PermissionAction.READ)
  @Get(":websiteId")
  @ApiOperation({ summary: "Get website" })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
  ) {
    return this.websites.findOne(businessId, websiteId);
  }

  @RequirePermission(RbacFeature.WEBSITE_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":websiteId")
  @ApiOperation({ summary: "Update website" })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
    @Body() dto: UpdateWebsiteDto,
  ) {
    return this.websites.update(user, businessId, websiteId, dto);
  }

  @RequirePermission(RbacFeature.WEBSITE_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":websiteId/config")
  @ApiOperation({ summary: "Update website configuration" })
  updateConfig(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
    @Body() dto: UpdateWebsiteConfigDto,
  ) {
    return this.websites.updateConfig(user, businessId, websiteId, dto);
  }

  @RequirePermission(RbacFeature.WEBSITE_MANAGEMENT, PermissionAction.CREATE)
  @Post(":websiteId/domains")
  @ApiOperation({ summary: "Add website domain" })
  addDomain(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
    @Body() dto: CreateWebsiteDomainDto,
  ) {
    return this.websites.addDomain(businessId, websiteId, dto);
  }

  @RequirePermission(RbacFeature.WEBSITE_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":websiteId/publish")
  @ApiOperation({ summary: "Publish website" })
  publish(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
  ) {
    return this.websites.publish(user, businessId, websiteId);
  }

  @RequirePermission(RbacFeature.WEBSITE_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":websiteId/unpublish")
  @ApiOperation({ summary: "Unpublish website" })
  unpublish(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
  ) {
    return this.websites.unpublish(user, businessId, websiteId);
  }

  @RequirePermission(RbacFeature.WEBSITE_MANAGEMENT, PermissionAction.DELETE)
  @Delete(":websiteId")
  @ApiOperation({ summary: "Delete website" })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("websiteId", ParseUUIDPipe) websiteId: string,
  ) {
    return this.websites.remove(user, businessId, websiteId);
  }
}
