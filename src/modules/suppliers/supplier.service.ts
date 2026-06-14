import { Injectable } from "@nestjs/common";

import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import {
  CancelPurchaseOrderDto,
  CreatePurchaseOrderDto,
  CreateSupplierDto,
  CreateSupplierPurchaseReturnDto,
  QueryPurchaseOrderDto,
  QuerySupplierDto,
  QuerySupplierInvoiceDto,
  QuerySupplierPurchaseReturnDto,
  ReceivePurchaseOrderDto,
  SupplierProductMapDto,
  UpdatePurchaseOrderDto,
  UpdateSupplierDto,
  UpdateSupplierProductMapDto,
} from "./dto/supplier.dto";
import { PurchaseOrderReceivingService } from "./application/purchase-order-receiving.service";
import { PurchaseOrderService } from "./application/purchase-order.service";
import { PurchaseReturnService } from "./application/purchase-return.service";
import { SupplierCrudService } from "./application/supplier-crud.service";
import { SupplierInvoiceQueryService } from "./application/supplier-invoice-query.service";
import { SupplierProductService } from "./application/supplier-product.service";

@Injectable()
export class SupplierService {
  constructor(
    private readonly crud: SupplierCrudService,
    private readonly products: SupplierProductService,
    private readonly purchaseOrders: PurchaseOrderService,
    private readonly receiving: PurchaseOrderReceivingService,
    private readonly invoiceQueries: SupplierInvoiceQueryService,
    private readonly returns: PurchaseReturnService,
  ) {}

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreateSupplierDto,
  ) {
    return this.crud.create(currentUser, businessId, dto);
  }

  async findAll(businessId: string, query: QuerySupplierDto) {
    return this.crud.findAll(businessId, query);
  }

  async findOne(businessId: string, supplierId: string) {
    return this.crud.findOne(businessId, supplierId);
  }

  async update(
    currentUser: CurrentUserPayload,
    businessId: string,
    supplierId: string,
    dto: UpdateSupplierDto,
  ) {
    return this.crud.update(currentUser, businessId, supplierId, dto);
  }

  async remove(
    currentUser: CurrentUserPayload,
    businessId: string,
    supplierId: string,
  ) {
    return this.crud.remove(currentUser, businessId, supplierId);
  }

  async addProduct(
    businessId: string,
    supplierId: string,
    dto: SupplierProductMapDto,
  ) {
    return this.products.addProduct(businessId, supplierId, dto);
  }

  async findProducts(businessId: string, supplierId: string) {
    return this.products.findProducts(businessId, supplierId);
  }

  async updateProduct(
    businessId: string,
    supplierId: string,
    productMapId: string,
    dto: UpdateSupplierProductMapDto,
  ) {
    return this.products.updateProduct(
      businessId,
      supplierId,
      productMapId,
      dto,
    );
  }

  async removeProduct(
    businessId: string,
    supplierId: string,
    productMapId: string,
  ) {
    return this.products.removeProduct(businessId, supplierId, productMapId);
  }

  async createPurchaseOrder(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreatePurchaseOrderDto,
  ) {
    return this.purchaseOrders.createPurchaseOrder(
      currentUser,
      businessId,
      dto,
    );
  }

  async findPurchaseOrders(businessId: string, query: QueryPurchaseOrderDto) {
    return this.purchaseOrders.findPurchaseOrders(businessId, query);
  }

  async findPurchaseOrder(businessId: string, purchaseOrderId: string) {
    return this.purchaseOrders.findPurchaseOrder(businessId, purchaseOrderId);
  }

  async updatePurchaseOrder(
    currentUser: CurrentUserPayload,
    businessId: string,
    purchaseOrderId: string,
    dto: UpdatePurchaseOrderDto,
  ) {
    return this.purchaseOrders.updatePurchaseOrder(
      currentUser,
      businessId,
      purchaseOrderId,
      dto,
    );
  }

  async receivePurchaseOrder(
    currentUser: CurrentUserPayload,
    businessId: string,
    purchaseOrderId: string,
    dto: ReceivePurchaseOrderDto,
  ) {
    return this.receiving.receivePurchaseOrder(
      currentUser,
      businessId,
      purchaseOrderId,
      dto,
    );
  }

  async cancelPurchaseOrder(
    currentUser: CurrentUserPayload,
    businessId: string,
    purchaseOrderId: string,
    dto: CancelPurchaseOrderDto,
  ) {
    return this.purchaseOrders.cancelPurchaseOrder(
      currentUser,
      businessId,
      purchaseOrderId,
      dto,
    );
  }

  async removePurchaseOrder(businessId: string, purchaseOrderId: string) {
    return this.purchaseOrders.removePurchaseOrder(businessId, purchaseOrderId);
  }

  async findSupplierInvoices(
    businessId: string,
    query: QuerySupplierInvoiceDto,
  ) {
    return this.invoiceQueries.findSupplierInvoices(businessId, query);
  }

  async findSupplierInvoice(businessId: string, supplierInvoiceId: string) {
    return this.invoiceQueries.findSupplierInvoice(
      businessId,
      supplierInvoiceId,
    );
  }

  async createPurchaseReturn(
    currentUser: CurrentUserPayload,
    businessId: string,
    purchaseOrderId: string,
    dto: CreateSupplierPurchaseReturnDto,
  ) {
    return this.returns.createPurchaseReturn(
      currentUser,
      businessId,
      purchaseOrderId,
      dto,
    );
  }

  async findPurchaseReturns(
    businessId: string,
    query: QuerySupplierPurchaseReturnDto,
  ) {
    return this.returns.findPurchaseReturns(businessId, query);
  }

  async findPurchaseReturn(businessId: string, purchaseReturnId: string) {
    return this.returns.findPurchaseReturn(businessId, purchaseReturnId);
  }

  async completePurchaseReturn(
    currentUser: CurrentUserPayload,
    businessId: string,
    purchaseReturnId: string,
  ) {
    return this.returns.completePurchaseReturn(
      currentUser,
      businessId,
      purchaseReturnId,
    );
  }

  async cancelPurchaseReturn(businessId: string, purchaseReturnId: string) {
    return this.returns.cancelPurchaseReturn(businessId, purchaseReturnId);
  }
}
