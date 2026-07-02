import { PermissionAction, RbacFeature } from "@/database/schema";
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
  BulkUpdatePaymentGatewayConfigDto,
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
  findGateways(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryPaymentGatewayDto,
  ) {
    return this.gateways.findGateways(query);
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
  @Patch("configs/bulk")
  @ApiOperation({ summary: "Update payment gateway configuration" })
  bulkUpdateConfig(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: BulkUpdatePaymentGatewayConfigDto,
  ) {
    return this.gateways.bulkUpdateConfig(user, businessId, dto);
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
}
