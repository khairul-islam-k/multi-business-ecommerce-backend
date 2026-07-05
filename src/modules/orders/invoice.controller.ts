import { PermissionAction, RbacFeature } from "@/database/schema";
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../business/guards/business.guard";
import { SubscriptionGuard } from "../packages/guards/subscription.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { PermissionGuard } from "../permissions/guards/permission.guard";
import { QueryInvoiceDto } from "./dto/order.dto";
import { OrderService } from "./order.service";

@ApiTags("Invoices")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("orders/businesses/:businessId/invoices")
export class InvoiceController {
  constructor(private readonly orders: OrderService) {}

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({
    summary: "Get invoices",
    description:
      "Shows customer invoices for this business so staff can review invoice totals, payment status, linked order details, and invoice items.",
  })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryInvoiceDto,
  ) {
    return this.orders.findInvoices(businessId, query);
  }

  @RequirePermission(RbacFeature.ORDER_MANAGEMENT, PermissionAction.READ)
  @Get(":invoiceId")
  @ApiOperation({
    summary: "Get invoice",
    description:
      "Shows one customer invoice for this business with its linked order, customer, tax, item, and payment details.",
  })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("invoiceId", ParseUUIDPipe) invoiceId: string,
  ) {
    return this.orders.findInvoice(businessId, invoiceId);
  }
}
