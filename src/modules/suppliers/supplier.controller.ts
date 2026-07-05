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
  CancelPurchaseOrderDto,
  CreatePurchaseOrderDto,
  CreateSupplierDto,
  CreateSupplierPurchaseReturnDto,
  QueryPurchaseOrderDto,
  QuerySupplierDto,
  QuerySupplierInvoiceDto,
  QuerySupplierProductDto,
  QuerySupplierProductMapDto,
  QuerySupplierPurchaseReturnDto,
  ReceivePurchaseOrderDto,
  SupplierProductMapDto,
  UpdatePurchaseOrderDto,
  UpdateSupplierDto,
  UpdateSupplierProductMapDto,
} from "./dto/supplier.dto";
import { SupplierService } from "./supplier.service";

import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";

@ApiTags("Suppliers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("suppliers/businesses/:businessId")
export class SupplierController {
  constructor(private readonly suppliers: SupplierService) {}

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.CREATE)
  @Post()
  @ApiOperation({
    summary: "Create supplier",
    description:
      "Creates supplier using the information in the request. Use this when a staff member wants to add a new record and receive the saved details back.",
  })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateSupplierDto,
  ) {
    return this.suppliers.create(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({
    summary: "Get suppliers",
    description:
      "Shows suppliers that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QuerySupplierDto,
  ) {
    return this.suppliers.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.READ)
  @Get("products")
  @ApiOperation({
    summary: "Get all supplier products",
    description:
      "Shows supplier product mappings across all suppliers for the current business.",
  })
  findAllProducts(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QuerySupplierProductDto,
  ) {
    return this.suppliers.findAllProducts(businessId, query);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.READ)
  @Get("supplier-invoices")
  @ApiOperation({
    summary: "Get supplier invoices",
    description:
      "Shows supplier invoices that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findSupplierInvoices(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QuerySupplierInvoiceDto,
  ) {
    return this.suppliers.findSupplierInvoices(businessId, query);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.READ)
  @Get("supplier-invoices/:supplierInvoiceId")
  @ApiOperation({
    summary: "Get supplier invoice",
    description:
      "Shows supplier invoice that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findSupplierInvoice(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("supplierInvoiceId", ParseUUIDPipe) supplierInvoiceId: string,
  ) {
    return this.suppliers.findSupplierInvoice(businessId, supplierInvoiceId);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.READ)
  @Get("purchase-returns")
  @ApiOperation({
    summary: "Get supplier purchase returns",
    description:
      "Shows supplier purchase returns that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findPurchaseReturns(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QuerySupplierPurchaseReturnDto,
  ) {
    return this.suppliers.findPurchaseReturns(businessId, query);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.READ)
  @Get("purchase-returns/:purchaseReturnId")
  @ApiOperation({
    summary: "Get supplier purchase return",
    description:
      "Shows supplier purchase return that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findPurchaseReturn(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("purchaseReturnId", ParseUUIDPipe) purchaseReturnId: string,
  ) {
    return this.suppliers.findPurchaseReturn(businessId, purchaseReturnId);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch("purchase-returns/:purchaseReturnId/complete")
  @ApiOperation({
    summary: "Complete supplier purchase return",
    description:
      "Completes supplier purchase return and applies the final system updates for this workflow.",
  })
  completePurchaseReturn(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("purchaseReturnId", ParseUUIDPipe) purchaseReturnId: string,
  ) {
    return this.suppliers.completePurchaseReturn(
      user,
      businessId,
      purchaseReturnId,
    );
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch("purchase-returns/:purchaseReturnId/cancel")
  @ApiOperation({
    summary: "Cancel supplier purchase return",
    description:
      "Cancels supplier purchase return when it should not continue. The system also updates related records that depend on this status.",
  })
  cancelPurchaseReturn(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("purchaseReturnId", ParseUUIDPipe) purchaseReturnId: string,
  ) {
    return this.suppliers.cancelPurchaseReturn(businessId, purchaseReturnId);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.READ)
  @Get("purchase-orders")
  @ApiOperation({
    summary: "Get supplier purchase orders",
    description:
      "Shows supplier purchase orders that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findPurchaseOrders(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryPurchaseOrderDto,
  ) {
    return this.suppliers.findPurchaseOrders(businessId, query);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.CREATE)
  @Post("purchase-orders")
  @ApiOperation({
    summary: "Create supplier purchase order",
    description:
      "Creates supplier purchase order using the information in the request. Use this when a staff member wants to add a new record and receive the saved details back.",
  })
  createPurchaseOrder(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreatePurchaseOrderDto,
  ) {
    return this.suppliers.createPurchaseOrder(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.CREATE)
  @Post("purchase-orders/:purchaseOrderId/returns")
  @ApiOperation({
    summary: "Create supplier purchase return request",
    description:
      "Creates supplier purchase return request using the information in the request. Use this when a staff member wants to add a new record and receive the saved details back.",
  })
  createPurchaseReturn(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("purchaseOrderId", ParseUUIDPipe) purchaseOrderId: string,
    @Body() dto: CreateSupplierPurchaseReturnDto,
  ) {
    return this.suppliers.createPurchaseReturn(
      user,
      businessId,
      purchaseOrderId,
      dto,
    );
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.READ)
  @Get("purchase-orders/:purchaseOrderId")
  @ApiOperation({
    summary: "Get supplier purchase order",
    description:
      "Shows supplier purchase order that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findPurchaseOrder(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("purchaseOrderId", ParseUUIDPipe) purchaseOrderId: string,
  ) {
    return this.suppliers.findPurchaseOrder(businessId, purchaseOrderId);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch("purchase-orders/:purchaseOrderId")
  @ApiOperation({
    summary: "Update supplier purchase order",
    description:
      "Updates supplier purchase order with the new information provided. Only the fields sent in the request are changed.",
  })
  updatePurchaseOrder(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("purchaseOrderId", ParseUUIDPipe) purchaseOrderId: string,
    @Body() dto: UpdatePurchaseOrderDto,
  ) {
    return this.suppliers.updatePurchaseOrder(
      user,
      businessId,
      purchaseOrderId,
      dto,
    );
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch("purchase-orders/:purchaseOrderId/receive")
  @ApiOperation({
    summary: "Receive supplier purchase order",
    description:
      "Records supplier purchase order as received so stock, supplier, and finance information can be brought up to date.",
  })
  receivePurchaseOrder(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("purchaseOrderId", ParseUUIDPipe) purchaseOrderId: string,
    @Body() dto: ReceivePurchaseOrderDto,
  ) {
    return this.suppliers.receivePurchaseOrder(
      user,
      businessId,
      purchaseOrderId,
      dto,
    );
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch("purchase-orders/:purchaseOrderId/cancel")
  @ApiOperation({
    summary: "Cancel supplier purchase order",
    description:
      "Cancels supplier purchase order when it should not continue. The system also updates related records that depend on this status.",
  })
  cancelPurchaseOrder(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("purchaseOrderId", ParseUUIDPipe) purchaseOrderId: string,
    @Body() dto: CancelPurchaseOrderDto,
  ) {
    return this.suppliers.cancelPurchaseOrder(
      user,
      businessId,
      purchaseOrderId,
      dto,
    );
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.DELETE)
  @Delete("purchase-orders/:purchaseOrderId")
  @ApiOperation({
    summary: "Delete supplier purchase order",
    description:
      "Deletes supplier purchase order from normal day-to-day use. Records may be kept internally when the system needs history for reporting or auditing.",
  })
  removePurchaseOrder(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("purchaseOrderId", ParseUUIDPipe) purchaseOrderId: string,
  ) {
    return this.suppliers.removePurchaseOrder(
      user,
      businessId,
      purchaseOrderId,
    );
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.READ)
  @Get(":supplierId")
  @ApiOperation({
    summary: "Get supplier",
    description:
      "Shows supplier that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("supplierId", ParseUUIDPipe) supplierId: string,
  ) {
    return this.suppliers.findOne(businessId, supplierId);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":supplierId")
  @ApiOperation({
    summary: "Update supplier",
    description:
      "Updates supplier with the new information provided. Only the fields sent in the request are changed.",
  })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("supplierId", ParseUUIDPipe) supplierId: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliers.update(user, businessId, supplierId, dto);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.DELETE)
  @Delete(":supplierId")
  @ApiOperation({
    summary: "Delete supplier",
    description:
      "Deletes supplier from normal day-to-day use. Records may be kept internally when the system needs history for reporting or auditing.",
  })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("supplierId", ParseUUIDPipe) supplierId: string,
  ) {
    return this.suppliers.remove(user, businessId, supplierId);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.CREATE)
  @Post(":supplierId/products")
  @ApiOperation({
    summary: "Add supplier product",
    description:
      "Adds supplier product to the selected record and returns the updated information.",
  })
  addProduct(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("supplierId", ParseUUIDPipe) supplierId: string,
    @Body() dto: SupplierProductMapDto,
  ) {
    return this.suppliers.addProduct(businessId, supplierId, dto);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.READ)
  @Get(":supplierId/products/:productMapId")
  @ApiOperation({
    summary: "Get supplier product",
    description:
      "Shows a single supplier product that the current user is allowed to view. Use this to review information before making a decision or change.",
  })
  findProduct(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("supplierId", ParseUUIDPipe) supplierId: string,
    @Param("productMapId", ParseUUIDPipe) productMapId: string,
  ) {
    return this.suppliers.findProduct(businessId, supplierId, productMapId);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.READ)
  @Get(":supplierId/products")
  @ApiOperation({
    summary: "Get supplier products",
    description:
      "Shows supplier products that the current user is allowed to view. Use this to review saved information before making a decision or change.",
  })
  findProducts(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("supplierId", ParseUUIDPipe) supplierId: string,
    @Query() query: QuerySupplierProductMapDto,
  ) {
    return this.suppliers.findProducts(businessId, supplierId, query);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":supplierId/products/:productMapId")
  @ApiOperation({
    summary: "Update supplier product",
    description:
      "Updates supplier product with the new information provided. Only the fields sent in the request are changed.",
  })
  updateProduct(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("supplierId", ParseUUIDPipe) supplierId: string,
    @Param("productMapId", ParseUUIDPipe) productMapId: string,
    @Body() dto: UpdateSupplierProductMapDto,
  ) {
    return this.suppliers.updateProduct(
      businessId,
      supplierId,
      productMapId,
      dto,
    );
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.DELETE)
  @Delete(":supplierId/products/:productMapId")
  @ApiOperation({
    summary: "Remove supplier product",
    description:
      "Removes supplier product from the selected record and returns confirmation when the change is complete.",
  })
  removeProduct(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("supplierId", ParseUUIDPipe) supplierId: string,
    @Param("productMapId", ParseUUIDPipe) productMapId: string,
  ) {
    return this.suppliers.removeProduct(businessId, supplierId, productMapId);
  }
}
