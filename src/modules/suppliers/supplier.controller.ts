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
import { PermissionAction, RbacFeature } from "@prisma/client";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { BusinessGuard } from "../business/guards/business.guard";
import { SubscriptionGuard } from "../packages/guards/subscription.guard";
import { RequirePermission } from "../permissions/decorators/require-permission.decorator";
import { PermissionGuard } from "../permissions/guards/permission.guard";
import {
  CreatePurchaseOrderDto,
  CreateSupplierPurchaseReturnDto,
  CreateSupplierDto,
  QueryPurchaseOrderDto,
  QuerySupplierPurchaseReturnDto,
  QuerySupplierInvoiceDto,
  QuerySupplierDto,
  ReceivePurchaseOrderDto,
  SupplierProductMapDto,
  UpdatePurchaseOrderDto,
  UpdateSupplierDto,
  UpdateSupplierProductMapDto,
} from "./dto/supplier.dto";
import { SupplierService } from "./supplier.service";

@ApiTags("Suppliers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SubscriptionGuard, BusinessGuard, PermissionGuard)
@Controller("suppliers/businesses/:businessId")
export class SupplierController {
  constructor(private readonly suppliers: SupplierService) {}

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.CREATE)
  @Post()
  @ApiOperation({ summary: "Create supplier" })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreateSupplierDto,
  ) {
    return this.suppliers.create(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.READ)
  @Get()
  @ApiOperation({ summary: "Get suppliers" })
  findAll(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QuerySupplierDto,
  ) {
    return this.suppliers.findAll(businessId, query);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.READ)
  @Get("supplier-invoices")
  @ApiOperation({ summary: "Get supplier invoices" })
  findSupplierInvoices(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QuerySupplierInvoiceDto,
  ) {
    return this.suppliers.findSupplierInvoices(businessId, query);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.READ)
  @Get("supplier-invoices/:supplierInvoiceId")
  @ApiOperation({ summary: "Get supplier invoice" })
  findSupplierInvoice(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("supplierInvoiceId", ParseUUIDPipe) supplierInvoiceId: string,
  ) {
    return this.suppliers.findSupplierInvoice(businessId, supplierInvoiceId);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.READ)
  @Get("purchase-returns")
  @ApiOperation({ summary: "Get supplier purchase returns" })
  findPurchaseReturns(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QuerySupplierPurchaseReturnDto,
  ) {
    return this.suppliers.findPurchaseReturns(businessId, query);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.READ)
  @Get("purchase-returns/:purchaseReturnId")
  @ApiOperation({ summary: "Get supplier purchase return" })
  findPurchaseReturn(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("purchaseReturnId", ParseUUIDPipe) purchaseReturnId: string,
  ) {
    return this.suppliers.findPurchaseReturn(businessId, purchaseReturnId);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch("purchase-returns/:purchaseReturnId/complete")
  @ApiOperation({ summary: "Complete supplier purchase return" })
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
  @ApiOperation({ summary: "Cancel supplier purchase return" })
  cancelPurchaseReturn(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("purchaseReturnId", ParseUUIDPipe) purchaseReturnId: string,
  ) {
    return this.suppliers.cancelPurchaseReturn(businessId, purchaseReturnId);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.READ)
  @Get("purchase-orders")
  @ApiOperation({ summary: "Get supplier purchase orders" })
  findPurchaseOrders(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Query() query: QueryPurchaseOrderDto,
  ) {
    return this.suppliers.findPurchaseOrders(businessId, query);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.CREATE)
  @Post("purchase-orders")
  @ApiOperation({ summary: "Create supplier purchase order" })
  createPurchaseOrder(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: CreatePurchaseOrderDto,
  ) {
    return this.suppliers.createPurchaseOrder(user, businessId, dto);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.CREATE)
  @Post("purchase-orders/:purchaseOrderId/returns")
  @ApiOperation({ summary: "Create supplier purchase return request" })
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
  @ApiOperation({ summary: "Get supplier purchase order" })
  findPurchaseOrder(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("purchaseOrderId", ParseUUIDPipe) purchaseOrderId: string,
  ) {
    return this.suppliers.findPurchaseOrder(businessId, purchaseOrderId);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch("purchase-orders/:purchaseOrderId")
  @ApiOperation({ summary: "Update supplier purchase order" })
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
  @ApiOperation({ summary: "Receive supplier purchase order" })
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

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.DELETE)
  @Delete("purchase-orders/:purchaseOrderId")
  @ApiOperation({ summary: "Delete supplier purchase order" })
  removePurchaseOrder(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("purchaseOrderId", ParseUUIDPipe) purchaseOrderId: string,
  ) {
    return this.suppliers.removePurchaseOrder(businessId, purchaseOrderId);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.READ)
  @Get(":supplierId")
  @ApiOperation({ summary: "Get supplier" })
  findOne(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("supplierId", ParseUUIDPipe) supplierId: string,
  ) {
    return this.suppliers.findOne(businessId, supplierId);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":supplierId")
  @ApiOperation({ summary: "Update supplier" })
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
  @ApiOperation({ summary: "Delete supplier" })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("supplierId", ParseUUIDPipe) supplierId: string,
  ) {
    return this.suppliers.remove(user, businessId, supplierId);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.CREATE)
  @Post(":supplierId/products")
  @ApiOperation({ summary: "Add supplier product" })
  addProduct(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("supplierId", ParseUUIDPipe) supplierId: string,
    @Body() dto: SupplierProductMapDto,
  ) {
    return this.suppliers.addProduct(businessId, supplierId, dto);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.READ)
  @Get(":supplierId/products")
  @ApiOperation({ summary: "Get supplier products" })
  findProducts(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("supplierId", ParseUUIDPipe) supplierId: string,
  ) {
    return this.suppliers.findProducts(businessId, supplierId);
  }

  @RequirePermission(RbacFeature.SUPPLIER_MANAGEMENT, PermissionAction.UPDATE)
  @Patch(":supplierId/products/:productMapId")
  @ApiOperation({ summary: "Update supplier product" })
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
  @ApiOperation({ summary: "Remove supplier product" })
  removeProduct(
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Param("supplierId", ParseUUIDPipe) supplierId: string,
    @Param("productMapId", ParseUUIDPipe) productMapId: string,
  ) {
    return this.suppliers.removeProduct(businessId, supplierId, productMapId);
  }
}
