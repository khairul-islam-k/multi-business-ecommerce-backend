import { PermissionAction, RbacFeature } from "@/database/schema";
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

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../business/guards/business.guard";
import { SubscriptionGuard } from "../packages/guards/subscription.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { PermissionGuard } from "../permissions/guards/permission.guard";
import {
  BulkCreatePaymentGatewayConfigDto,
  BulkUpdatePaymentGatewayConfigDto,
  CreatePaymentGatewayConfigDto,
  QueryPaymentGatewayConfigDto,
  QueryPaymentGatewayDto,
  UpdatePaymentGatewayConfigDto,
} from "./dto/payment-gateway.dto";
import { PaymentGatewayService } from "./payment-gateway.service";

import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";

@ApiTags("Payment Gateways")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("payment-gateways/businesses/:businessId")
export class PaymentGatewayController {
  constructor(private readonly gateways: PaymentGatewayService) {}

  @RequirePermission(RbacFeature.PAYMENT_MANAGEMENT, PermissionAction.READ)
  @Get("gateways")
  @ApiOperation({ summary: "Get predefined payment gateways" })
  findGateways(@Query() query: QueryPaymentGatewayDto) {
    return this.gateways.findGateways(query);
  }

  @RequirePermission(RbacFeature.PAYMENT_MANAGEMENT, PermissionAction.CREATE)
  @Post("configs/bulk")
  @ApiOperation({ summary: "Configure payment gateways for business" })
  createConfigBulk(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: BulkCreatePaymentGatewayConfigDto,
  ) {
    return this.gateways.bulkCreateConfig(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.PAYMENT_MANAGEMENT, PermissionAction.CREATE)
  @Post("configs")
  @ApiOperation({ summary: "Configure payment gateway for business" })
  createConfig(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreatePaymentGatewayConfigDto,
  ) {
    return this.gateways.createConfig(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.PAYMENT_MANAGEMENT, PermissionAction.READ)
  @Get("configs")
  @ApiOperation({ summary: "Get business payment gateway configurations" })
  findConfigs(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryPaymentGatewayConfigDto,
  ) {
    return this.gateways.findConfigs(businessId, query);
  }

  @RequirePermission(RbacFeature.PAYMENT_MANAGEMENT, PermissionAction.UPDATE)
  @Patch("configs/:configId")
  @ApiOperation({ summary: "Update payment gateway configuration" })
  bulkUpdateConfig(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("configId", ParseUUIDPipe) configId: string,
    @Body() dto: BulkUpdatePaymentGatewayConfigDto,
  ) {
    return this.gateways.bulkUpdateConfig(user, businessId, configId, dto);
  }

  @RequirePermission(RbacFeature.PAYMENT_MANAGEMENT, PermissionAction.UPDATE)
  @Patch("configs/:configId")
  @ApiOperation({ summary: "Update payment gateway configuration" })
  updateConfig(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("configId", ParseUUIDPipe) configId: string,
    @Body() dto: UpdatePaymentGatewayConfigDto,
  ) {
    return this.gateways.updateConfig(user, businessId, configId, dto);
  }

  @RequirePermission(RbacFeature.PAYMENT_MANAGEMENT, PermissionAction.DELETE)
  @Delete("configs/:configId")
  @ApiOperation({ summary: "Delete payment gateway configuration" })
  removeConfig(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("configId", ParseUUIDPipe) configId: string,
  ) {
    return this.gateways.removeConfig(user, businessId, configId);
  }
}
