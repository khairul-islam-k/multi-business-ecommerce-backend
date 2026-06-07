import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  FinanceReceivableStatus,
  FinanceSourceType,
  InventoryMovementType,
  InventoryReferenceType,
  Prisma,
  SupplierInvoiceStatus,
  SupplierProductMapStatus,
  SupplierPurchaseOrderStatus,
  SupplierPurchaseReturnStatus,
  SupplierStatus,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../common/utils/api-response.util";
import { generateRandomCode } from "../../common/utils/code-generator.util";
import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { InventoryLookupService } from "../inventory/common/inventory-lookup.service";
import { FinanceLedgerService } from "../finance/common/finance-ledger.service";
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

const SUPPLIER_INCLUDE = {
  _count: {
    select: {
      products: true,
      orders: true,
    },
  },
} satisfies Prisma.SupplierInclude;

const PURCHASE_ORDER_INCLUDE = {
  supplier: true,
  tax: true,
  items: { orderBy: { createdAt: "asc" } },
  invoices: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.SupplierPurchaseOrderInclude;

const SUPPLIER_INVOICE_INCLUDE = {
  supplier: true,
  purchaseOrder: true,
  tax: true,
  items: { orderBy: { createdAt: "asc" } },
  payments: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.SupplierInvoiceInclude;

const PURCHASE_RETURN_INCLUDE = {
  supplier: true,
  purchaseOrder: true,
  supplierInvoice: true,
  tax: true,
  items: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.SupplierPurchaseReturnInclude;

const ORDER_MANUAL_STATUSES: SupplierPurchaseOrderStatus[] = [
  SupplierPurchaseOrderStatus.DRAFT,
  SupplierPurchaseOrderStatus.ORDERED,
  SupplierPurchaseOrderStatus.CANCELLED,
];

const SUPPLIER_CODE_RETRY_LIMIT = 5;

@Injectable()
export class SupplierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryLookup: InventoryLookupService,
    private readonly finance: FinanceLedgerService,
  ) {}

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreateSupplierDto,
  ) {
    const supplier = await this.prisma.supplier.create({
      data: {
        businessId,
        name: this.normalizeName(dto.name),
        companyName: this.normalizeNullableText(dto.companyName),
        email: this.normalizeNullableText(dto.email),
        phone: this.normalizeNullableText(dto.phone),
        address: this.normalizeNullableText(dto.address),
        city: this.normalizeNullableText(dto.city),
        country: this.normalizeNullableText(dto.country),
        status: dto.status ?? SupplierStatus.ACTIVE,
        note: this.normalizeNullableText(dto.note),
        createdBy: currentUser.id,
        updatedBy: currentUser.id,
      },
      include: SUPPLIER_INCLUDE,
    });

    return apiResponse(supplier, "Supplier created successfully");
  }

  async findAll(businessId: string, query: QuerySupplierDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.SupplierWhereInput = {
      businessId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { companyName: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
              { phone: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: query.sortOrder ?? "desc" },
        include: SUPPLIER_INCLUDE,
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findOne(businessId: string, supplierId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, businessId, deletedAt: null },
      include: SUPPLIER_INCLUDE,
    });

    if (!supplier) {
      throw new NotFoundException("Supplier not found");
    }

    return apiResponse(supplier);
  }

  async update(
    currentUser: CurrentUserPayload,
    businessId: string,
    supplierId: string,
    dto: UpdateSupplierDto,
  ) {
    await this.assertSupplierExists(businessId, supplierId);

    const supplier = await this.prisma.supplier.update({
      where: { id: supplierId },
      data: {
        ...(dto.name !== undefined && { name: this.normalizeName(dto.name) }),
        ...(dto.companyName !== undefined && {
          companyName: this.normalizeNullableText(dto.companyName),
        }),
        ...(dto.email !== undefined && {
          email: this.normalizeNullableText(dto.email),
        }),
        ...(dto.phone !== undefined && {
          phone: this.normalizeNullableText(dto.phone),
        }),
        ...(dto.address !== undefined && {
          address: this.normalizeNullableText(dto.address),
        }),
        ...(dto.city !== undefined && {
          city: this.normalizeNullableText(dto.city),
        }),
        ...(dto.country !== undefined && {
          country: this.normalizeNullableText(dto.country),
        }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.note !== undefined && {
          note: this.normalizeNullableText(dto.note),
        }),
        updatedBy: currentUser.id,
      },
      include: SUPPLIER_INCLUDE,
    });

    return apiResponse(supplier, "Supplier updated successfully");
  }

  async remove(
    currentUser: CurrentUserPayload,
    businessId: string,
    supplierId: string,
  ) {
    await this.assertSupplierExists(businessId, supplierId);
    await this.assertSupplierCanBeDeleted(businessId, supplierId);

    await this.prisma.supplier.update({
      where: { id: supplierId },
      data: {
        status: SupplierStatus.INACTIVE,
        deletedAt: new Date(),
        updatedBy: currentUser.id,
      },
    });

    return apiResponse(null, "Supplier deleted successfully");
  }

  async addProduct(
    businessId: string,
    supplierId: string,
    dto: SupplierProductMapDto,
  ) {
    await this.assertSupplierExists(businessId, supplierId, true);
    await this.inventoryLookup.assertStockItem(
      businessId,
      dto.productId,
      dto.variantId ?? null,
    );
    const itemKey = this.inventoryLookup.buildStockItemKey(
      dto.productId,
      dto.variantId,
    );

    try {
      const productMap = await this.prisma.supplierProductMap.create({
        data: {
          businessId,
          supplierId,
          productId: dto.productId,
          variantId: dto.variantId ?? null,
          itemKey,
          supplierSku: this.normalizeNullableText(dto.supplierSku),
          lastPurchasePrice: dto.lastPurchasePrice,
          minOrderQuantity: dto.minOrderQuantity,
          leadTimeDays: dto.leadTimeDays,
          status: dto.status ?? SupplierProductMapStatus.ACTIVE,
        },
      });

      return apiResponse(productMap, "Supplier product added successfully");
    } catch (error) {
      this.handleUniqueError(error, "Supplier product already exists");
    }
  }

  async findProducts(businessId: string, supplierId: string) {
    await this.assertSupplierExists(businessId, supplierId);

    const products = await this.prisma.supplierProductMap.findMany({
      where: { businessId, supplierId },
      orderBy: { createdAt: "desc" },
    });

    return apiResponse(products);
  }

  async updateProduct(
    businessId: string,
    supplierId: string,
    productMapId: string,
    dto: UpdateSupplierProductMapDto,
  ) {
    const existingMap = await this.assertSupplierProductMapExists(
      businessId,
      supplierId,
      productMapId,
    );

    const nextProductId = dto.productId ?? existingMap.productId;
    const nextVariantId =
      dto.variantId !== undefined ? dto.variantId : existingMap.variantId;
    const itemKey = this.inventoryLookup.buildStockItemKey(
      nextProductId,
      nextVariantId,
    );

    await this.inventoryLookup.assertStockItem(
      businessId,
      nextProductId,
      nextVariantId,
    );

    try {
      const productMap = await this.prisma.supplierProductMap.update({
        where: { id: productMapId },
        data: {
          ...(dto.productId !== undefined && { productId: dto.productId }),
          ...(dto.productId !== undefined || dto.variantId !== undefined
            ? {
                productId: nextProductId,
                variantId: nextVariantId ?? null,
                itemKey,
              }
            : {}),
          ...(dto.supplierSku !== undefined && {
            supplierSku: this.normalizeNullableText(dto.supplierSku),
          }),
          ...(dto.lastPurchasePrice !== undefined && {
            lastPurchasePrice: dto.lastPurchasePrice,
          }),
          ...(dto.minOrderQuantity !== undefined && {
            minOrderQuantity: dto.minOrderQuantity,
          }),
          ...(dto.leadTimeDays !== undefined && {
            leadTimeDays: dto.leadTimeDays,
          }),
          ...(dto.status !== undefined && { status: dto.status }),
        },
      });

      return apiResponse(productMap, "Supplier product updated successfully");
    } catch (error) {
      this.handleUniqueError(error, "Supplier product already exists");
    }
  }

  async removeProduct(
    businessId: string,
    supplierId: string,
    productMapId: string,
  ) {
    await this.assertSupplierProductMapExists(
      businessId,
      supplierId,
      productMapId,
    );

    await this.prisma.supplierProductMap.delete({
      where: { id: productMapId },
    });

    return apiResponse(null, "Supplier product removed successfully");
  }

  async createPurchaseOrder(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreatePurchaseOrderDto,
  ) {
    this.assertItems(dto.items);
    this.assertManualOrderStatus(
      dto.status ?? SupplierPurchaseOrderStatus.DRAFT,
    );

    await Promise.all([
      this.assertSupplierExists(businessId, dto.supplierId, true),
      this.inventoryLookup.assertWarehouseExists(businessId, dto.warehouseId),
      ...dto.items.map((item) =>
        this.inventoryLookup.assertStockItem(
          businessId,
          item.productId,
          item.variantId ?? null,
        ),
      ),
    ]);

    const tax = await this.finance.assertActiveTax(
      this.prisma,
      businessId,
      dto.taxId,
    );
    const totals = this.calculateOrderTotals(
      dto.items,
      dto.shippingCost ?? 0,
      tax.rate,
    );
    const purchaseOrderNo =
      await this.generateUniquePurchaseOrderNo(businessId);

    try {
      const purchaseOrder = await this.prisma.supplierPurchaseOrder.create({
        data: {
          businessId,
          supplierId: dto.supplierId,
          warehouseId: dto.warehouseId,
          taxId: tax.id,
          purchaseOrderNo,
          orderDate: new Date(),
          expectedDeliveryDate: dto.expectedDeliveryDate,
          status: dto.status ?? SupplierPurchaseOrderStatus.DRAFT,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          taxRate: tax.rate,
          shippingCost: totals.shippingCost,
          totalAmount: totals.totalAmount,
          note: this.normalizeNullableText(dto.note),
          createdBy: currentUser.id,
          items: {
            create: dto.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId ?? null,
              quantityOrdered: item.quantityOrdered,
              unitCost: item.unitCost,
              discountAmount: item.discountAmount ?? 0,
              taxAmount: this.calculateLineTax(item, tax.rate),
              lineTotal: this.calculateLineTotal(item, tax.rate),
            })),
          },
        },
        include: PURCHASE_ORDER_INCLUDE,
      });

      return apiResponse(
        purchaseOrder,
        "Supplier purchase order created successfully",
      );
    } catch (error) {
      this.handleUniqueError(error, "Purchase order number already exists");
    }
  }

  async findPurchaseOrders(businessId: string, query: QueryPurchaseOrderDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.SupplierPurchaseOrderWhereInput = {
      businessId,
      deletedAt: null,
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              {
                purchaseOrderNo: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
              { note: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.supplierPurchaseOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: PURCHASE_ORDER_INCLUDE,
      }),
      this.prisma.supplierPurchaseOrder.count({ where }),
    ]);

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findPurchaseOrder(businessId: string, purchaseOrderId: string) {
    const purchaseOrder = await this.prisma.supplierPurchaseOrder.findFirst({
      where: { id: purchaseOrderId, businessId, deletedAt: null },
      include: PURCHASE_ORDER_INCLUDE,
    });

    if (!purchaseOrder) {
      throw new NotFoundException("Purchase order not found");
    }

    return apiResponse(purchaseOrder);
  }

  async updatePurchaseOrder(
    currentUser: CurrentUserPayload,
    businessId: string,
    purchaseOrderId: string,
    dto: UpdatePurchaseOrderDto,
  ) {
    const existingOrder = await this.getPurchaseOrderOrThrow(
      businessId,
      purchaseOrderId,
    );

    if (existingOrder.status === SupplierPurchaseOrderStatus.RECEIVED) {
      throw new BadRequestException(
        "Received purchase order cannot be updated",
      );
    }

    if (dto.status !== undefined) {
      this.assertManualOrderStatus(dto.status);
    }

    const shippingCost = dto.shippingCost ?? existingOrder.shippingCost;
    const totalAmount = new Prisma.Decimal(existingOrder.subtotal)
      .minus(existingOrder.discountTotal)
      .plus(existingOrder.taxTotal)
      .plus(shippingCost);

    const purchaseOrder = await this.prisma.supplierPurchaseOrder.update({
      where: { id: purchaseOrderId },
      data: {
        ...(dto.expectedDeliveryDate !== undefined && {
          expectedDeliveryDate: dto.expectedDeliveryDate,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.shippingCost !== undefined && {
          shippingCost: dto.shippingCost,
          totalAmount,
        }),
        ...(dto.note !== undefined && {
          note: this.normalizeNullableText(dto.note),
        }),
        approvedBy:
          dto.status === SupplierPurchaseOrderStatus.ORDERED
            ? currentUser.id
            : undefined,
        approvedAt:
          dto.status === SupplierPurchaseOrderStatus.ORDERED
            ? new Date()
            : undefined,
      },
      include: PURCHASE_ORDER_INCLUDE,
    });

    return apiResponse(purchaseOrder, "Purchase order updated successfully");
  }

  async receivePurchaseOrder(
    currentUser: CurrentUserPayload,
    businessId: string,
    purchaseOrderId: string,
    dto: ReceivePurchaseOrderDto,
  ) {
    const purchaseOrder = await this.getPurchaseOrderOrThrow(
      businessId,
      purchaseOrderId,
    );

    if (purchaseOrder.status !== SupplierPurchaseOrderStatus.ORDERED) {
      throw new BadRequestException(
        "Only ordered purchase orders can be received",
      );
    }

    const receivedOrder = await this.prisma.$transaction(async (tx) => {
      for (const orderItem of purchaseOrder.items) {
        const quantityReceived = new Prisma.Decimal(orderItem.quantityOrdered);

        await tx.supplierPurchaseOrderItem.update({
          where: { id: orderItem.id },
          data: {
            quantityReceived,
          },
        });

        await this.inventoryLookup.applyStockDelta(tx, {
          businessId,
          warehouseId: purchaseOrder.warehouseId,
          productId: orderItem.productId,
          variantId: orderItem.variantId,
          quantityDelta: quantityReceived,
          movementType: InventoryMovementType.PURCHASE_IN,
          referenceType: InventoryReferenceType.PURCHASE_ORDER,
          referenceId: purchaseOrder.id,
          note: dto.note,
          createdBy: currentUser.id,
        });

        await tx.supplierProductMap.upsert({
          where: {
            businessId_supplierId_itemKey: {
              businessId,
              supplierId: purchaseOrder.supplierId,
              itemKey: this.inventoryLookup.buildStockItemKey(
                orderItem.productId,
                orderItem.variantId,
              ),
            },
          },
          update: {
            lastPurchasePrice: orderItem.unitCost,
            status: SupplierProductMapStatus.ACTIVE,
          },
          create: {
            businessId,
            supplierId: purchaseOrder.supplierId,
            productId: orderItem.productId,
            variantId: orderItem.variantId,
            itemKey: this.inventoryLookup.buildStockItemKey(
              orderItem.productId,
              orderItem.variantId,
            ),
            lastPurchasePrice: orderItem.unitCost,
            status: SupplierProductMapStatus.ACTIVE,
          },
        });
      }

      const supplierInvoice = await tx.supplierInvoice.create({
        data: {
          businessId,
          supplierId: purchaseOrder.supplierId,
          purchaseOrderId: purchaseOrder.id,
          taxId: purchaseOrder.taxId,
          invoiceNo:
            await this.finance.generateUniqueSupplierInvoiceNo(businessId),
          invoiceDate: new Date(),
          status: SupplierInvoiceStatus.UNPAID,
          subtotal: purchaseOrder.subtotal,
          discountTotal: purchaseOrder.discountTotal,
          taxTotal: purchaseOrder.taxTotal,
          taxRate: purchaseOrder.taxRate,
          shippingCost: purchaseOrder.shippingCost,
          totalAmount: purchaseOrder.totalAmount,
          paidAmount: 0,
          note: dto.note,
          createdBy: currentUser.id,
          items: {
            create: purchaseOrder.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantityOrdered,
              unitCost: item.unitCost,
              discountAmount: item.discountAmount,
              taxAmount: item.taxAmount,
              lineTotal: item.lineTotal,
            })),
          },
        },
      });

      await this.finance.createSupplierInvoicePayable(tx, {
        businessId,
        supplierId: purchaseOrder.supplierId,
        supplierInvoiceId: supplierInvoice.id,
        totalAmount: supplierInvoice.totalAmount,
        note: dto.note,
      });

      return tx.supplierPurchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          status: SupplierPurchaseOrderStatus.RECEIVED,
        },
        include: PURCHASE_ORDER_INCLUDE,
      });
    });

    return apiResponse(receivedOrder, "Purchase order received successfully");
  }

  async removePurchaseOrder(businessId: string, purchaseOrderId: string) {
    const purchaseOrder = await this.getPurchaseOrderOrThrow(
      businessId,
      purchaseOrderId,
    );

    if (purchaseOrder.status !== SupplierPurchaseOrderStatus.DRAFT) {
      throw new BadRequestException(
        "Only draft purchase orders can be deleted",
      );
    }

    await this.prisma.supplierPurchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { deletedAt: new Date() },
    });

    return apiResponse(null, "Purchase order deleted successfully");
  }

  async findSupplierInvoices(
    businessId: string,
    query: QuerySupplierInvoiceDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.SupplierInvoiceWhereInput = {
      businessId,
      deletedAt: null,
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { invoiceNo: { contains: query.search, mode: "insensitive" } },
              { note: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.supplierInvoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: SUPPLIER_INVOICE_INCLUDE,
      }),
      this.prisma.supplierInvoice.count({ where }),
    ]);

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findSupplierInvoice(businessId: string, supplierInvoiceId: string) {
    const invoice = await this.prisma.supplierInvoice.findFirst({
      where: { id: supplierInvoiceId, businessId, deletedAt: null },
      include: SUPPLIER_INVOICE_INCLUDE,
    });

    if (!invoice) {
      throw new NotFoundException("Supplier invoice not found");
    }

    return apiResponse(invoice);
  }

  async createPurchaseReturn(
    currentUser: CurrentUserPayload,
    businessId: string,
    purchaseOrderId: string,
    dto: CreateSupplierPurchaseReturnDto,
  ) {
    this.assertReturnItems(dto.items);

    const purchaseOrder = await this.prisma.supplierPurchaseOrder.findFirst({
      where: {
        id: purchaseOrderId,
        businessId,
        deletedAt: null,
        status: SupplierPurchaseOrderStatus.RECEIVED,
      },
      include: {
        items: true,
        invoices: {
          where: {
            deletedAt: null,
            status: {
              not: SupplierInvoiceStatus.CANCELLED,
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!purchaseOrder) {
      throw new NotFoundException("Received purchase order not found");
    }

    const supplierInvoice = purchaseOrder.invoices[0];

    if (!supplierInvoice) {
      throw new BadRequestException(
        "Purchase order must be received before return",
      );
    }

    const items = await this.buildPurchaseReturnItems(
      businessId,
      purchaseOrder,
      dto.items,
    );
    const totals = this.calculateReturnTotals(items);

    const purchaseReturn = await this.prisma.$transaction(async (tx) => {
      const createdReturn = await tx.supplierPurchaseReturn.create({
        data: {
          businessId,
          supplierId: purchaseOrder.supplierId,
          purchaseOrderId: purchaseOrder.id,
          supplierInvoiceId: supplierInvoice.id,
          warehouseId: purchaseOrder.warehouseId,
          taxId: purchaseOrder.taxId,
          returnNo: await this.generateUniqueReturnNo(businessId),
          returnDate: dto.returnDate ?? new Date(),
          status: SupplierPurchaseReturnStatus.PENDING,
          reason: this.normalizeNullableText(dto.reason),
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          taxRate: purchaseOrder.taxRate,
          totalAmount: totals.totalAmount,
          createdBy: currentUser.id,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              unitCost: item.unitCost,
              discountAmount: item.discountAmount,
              taxAmount: item.taxAmount,
              lineTotal: item.lineTotal,
              reason: this.normalizeNullableText(item.reason),
            })),
          },
        },
      });

      for (const item of items) {
        await this.inventoryLookup.reserveStock(tx, {
          businessId,
          warehouseId: purchaseOrder.warehouseId,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          referenceType: InventoryReferenceType.PURCHASE_RETURN,
          referenceId: createdReturn.id,
          note: dto.reason,
          createdBy: currentUser.id,
        });
      }

      await this.finance.createSupplierReturnReceivable(tx, {
        businessId,
        supplierId: purchaseOrder.supplierId,
        supplierReturnId: createdReturn.id,
        totalAmount: totals.totalAmount,
        note: dto.reason,
      });

      return tx.supplierPurchaseReturn.findFirst({
        where: { id: createdReturn.id, businessId },
        include: PURCHASE_RETURN_INCLUDE,
      });
    });

    return apiResponse(
      purchaseReturn,
      "Supplier purchase return request created successfully",
    );
  }

  async findPurchaseReturns(
    businessId: string,
    query: QuerySupplierPurchaseReturnDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.SupplierPurchaseReturnWhereInput = {
      businessId,
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.purchaseOrderId
        ? { purchaseOrderId: query.purchaseOrderId }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { returnNo: { contains: query.search, mode: "insensitive" } },
              { reason: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.supplierPurchaseReturn.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: PURCHASE_RETURN_INCLUDE,
      }),
      this.prisma.supplierPurchaseReturn.count({ where }),
    ]);

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findPurchaseReturn(businessId: string, purchaseReturnId: string) {
    const purchaseReturn = await this.prisma.supplierPurchaseReturn.findFirst({
      where: { id: purchaseReturnId, businessId },
      include: PURCHASE_RETURN_INCLUDE,
    });

    if (!purchaseReturn) {
      throw new NotFoundException("Supplier purchase return not found");
    }

    return apiResponse(purchaseReturn);
  }

  async completePurchaseReturn(
    currentUser: CurrentUserPayload,
    businessId: string,
    purchaseReturnId: string,
  ) {
    const purchaseReturn = await this.prisma.supplierPurchaseReturn.findFirst({
      where: {
        id: purchaseReturnId,
        businessId,
        status: SupplierPurchaseReturnStatus.PENDING,
      },
      include: { items: true },
    });

    if (!purchaseReturn) {
      throw new NotFoundException("Pending supplier purchase return not found");
    }

    const completedReturn = await this.prisma.$transaction(async (tx) => {
      for (const item of purchaseReturn.items) {
        await this.inventoryLookup.deductReservedStock(tx, {
          businessId,
          warehouseId: purchaseReturn.warehouseId,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          movementType: InventoryMovementType.PURCHASE_RETURN_OUT,
          referenceType: InventoryReferenceType.PURCHASE_RETURN,
          referenceId: purchaseReturn.id,
          note: purchaseReturn.reason,
          createdBy: currentUser.id,
        });
      }

      return tx.supplierPurchaseReturn.update({
        where: { id: purchaseReturn.id },
        data: {
          status: SupplierPurchaseReturnStatus.COMPLETED,
        },
        include: PURCHASE_RETURN_INCLUDE,
      });
    });

    return apiResponse(
      completedReturn,
      "Supplier purchase return completed successfully",
    );
  }

  async cancelPurchaseReturn(businessId: string, purchaseReturnId: string) {
    const purchaseReturn = await this.prisma.supplierPurchaseReturn.findFirst({
      where: {
        id: purchaseReturnId,
        businessId,
        status: SupplierPurchaseReturnStatus.PENDING,
      },
      include: { items: true },
    });

    if (!purchaseReturn) {
      throw new NotFoundException("Pending supplier purchase return not found");
    }

    const cancelledReturn = await this.prisma.$transaction(async (tx) => {
      for (const item of purchaseReturn.items) {
        await this.inventoryLookup.releaseStockReservation(tx, {
          businessId,
          warehouseId: purchaseReturn.warehouseId,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          referenceType: InventoryReferenceType.PURCHASE_RETURN,
          referenceId: purchaseReturn.id,
          note: purchaseReturn.reason,
        });
      }

      await tx.financeReceivable.updateMany({
        where: {
          businessId,
          sourceType: FinanceSourceType.SUPPLIER_RETURN,
          sourceId: purchaseReturn.id,
          status: {
            not: FinanceReceivableStatus.RECEIVED,
          },
        },
        data: {
          status: FinanceReceivableStatus.CANCELLED,
        },
      });

      return tx.supplierPurchaseReturn.update({
        where: { id: purchaseReturn.id },
        data: {
          status: SupplierPurchaseReturnStatus.CANCELLED,
        },
        include: PURCHASE_RETURN_INCLUDE,
      });
    });

    return apiResponse(
      cancelledReturn,
      "Supplier purchase return cancelled successfully",
    );
  }

  private async assertSupplierExists(
    businessId: string,
    supplierId: string,
    requireActive = false,
  ) {
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: supplierId,
        businessId,
        deletedAt: null,
        ...(requireActive ? { status: SupplierStatus.ACTIVE } : {}),
      },
      select: { id: true },
    });

    if (!supplier) {
      throw new NotFoundException("Supplier not found");
    }
  }

  private async assertSupplierCanBeDeleted(
    businessId: string,
    supplierId: string,
  ) {
    const referenceCounts = await Promise.all([
      this.prisma.supplierPurchaseOrder.count({
        where: { businessId, supplierId, deletedAt: null },
      }),
      this.prisma.supplierInvoice.count({
        where: { businessId, supplierId, deletedAt: null },
      }),
    ]);

    if (referenceCounts.some((count) => count > 0)) {
      throw new BadRequestException(
        "Supplier cannot be deleted while referenced by purchase records",
      );
    }
  }

  private async assertSupplierProductMapExists(
    businessId: string,
    supplierId: string,
    productMapId: string,
  ) {
    const productMap = await this.prisma.supplierProductMap.findFirst({
      where: { id: productMapId, businessId, supplierId },
      select: { id: true, productId: true, variantId: true },
    });

    if (!productMap) {
      throw new NotFoundException("Supplier product not found");
    }

    return productMap;
  }

  private async getPurchaseOrderOrThrow(
    businessId: string,
    purchaseOrderId: string,
  ) {
    const purchaseOrder = await this.prisma.supplierPurchaseOrder.findFirst({
      where: { id: purchaseOrderId, businessId, deletedAt: null },
      include: { items: true },
    });

    if (!purchaseOrder) {
      throw new NotFoundException("Purchase order not found");
    }

    return purchaseOrder;
  }

  private assertItems(
    items: { productId: string; variantId?: string | null }[],
  ) {
    if (items.length === 0) {
      throw new BadRequestException(
        "At least one purchase order item is required",
      );
    }

    const itemKeys = new Set(
      items.map((item) =>
        this.inventoryLookup.buildStockItemKey(item.productId, item.variantId),
      ),
    );

    if (itemKeys.size !== items.length) {
      throw new BadRequestException(
        "Purchase order cannot contain duplicate items",
      );
    }
  }

  private assertReturnItems(
    items: {
      productId: string;
      variantId?: string | null;
    }[],
  ) {
    if (items.length === 0) {
      throw new BadRequestException(
        "At least one purchase return item is required",
      );
    }

    const itemKeys = new Set(
      items.map((item) =>
        this.inventoryLookup.buildStockItemKey(item.productId, item.variantId),
      ),
    );

    if (itemKeys.size !== items.length) {
      throw new BadRequestException(
        "Purchase return cannot contain duplicate items",
      );
    }
  }

  private assertManualOrderStatus(status: SupplierPurchaseOrderStatus) {
    if (!ORDER_MANUAL_STATUSES.includes(status)) {
      throw new BadRequestException(
        "Purchase order receiving statuses are managed by receive action",
      );
    }
  }

  private calculateOrderTotals(
    items: {
      quantityOrdered: number;
      unitCost: number;
      discountAmount?: number;
    }[],
    shippingCost: number,
    taxRate: Prisma.Decimal.Value,
  ) {
    const subtotal = items.reduce(
      (total, item) => total + item.quantityOrdered * item.unitCost,
      0,
    );
    const discountTotal = items.reduce(
      (total, item) => total + (item.discountAmount ?? 0),
      0,
    );
    const taxTotal = items.reduce(
      (total, item) =>
        total + Number(this.calculateLineTax(item, taxRate).toString()),
      0,
    );

    return {
      subtotal,
      discountTotal,
      taxTotal,
      shippingCost,
      totalAmount: subtotal - discountTotal + taxTotal + shippingCost,
    };
  }

  private async generateUniquePurchaseOrderNo(businessId: string) {
    for (let attempt = 0; attempt < SUPPLIER_CODE_RETRY_LIMIT; attempt++) {
      const purchaseOrderNo = generateRandomCode("PO");

      const existingPurchaseOrder =
        await this.prisma.supplierPurchaseOrder.findFirst({
          where: {
            businessId,
            purchaseOrderNo,
          },
          select: { id: true },
        });

      if (!existingPurchaseOrder) {
        return purchaseOrderNo;
      }
    }

    throw new BadRequestException("Could not generate purchase order number");
  }

  private async generateUniqueReturnNo(businessId: string) {
    for (let attempt = 0; attempt < SUPPLIER_CODE_RETRY_LIMIT; attempt++) {
      const returnNo = generateRandomCode("RET");

      const existingReturn = await this.prisma.supplierPurchaseReturn.findFirst(
        {
          where: {
            businessId,
            returnNo,
          },
          select: { id: true },
        },
      );

      if (!existingReturn) {
        return returnNo;
      }
    }

    throw new BadRequestException("Could not generate purchase return number");
  }

  private async buildPurchaseReturnItems(
    businessId: string,
    purchaseOrder: Prisma.SupplierPurchaseOrderGetPayload<{
      include: {
        items: true;
        invoices: true;
      };
    }>,
    requestedItems: {
      productId: string;
      variantId?: string | null;
      quantity: number;
      reason?: string;
    }[],
  ) {
    const purchaseOrderItemMap = new Map(
      purchaseOrder.items.map((item) => [
        this.inventoryLookup.buildStockItemKey(item.productId, item.variantId),
        item,
      ]),
    );
    const existingReturnItems =
      await this.prisma.supplierPurchaseReturnItem.findMany({
        where: {
          purchaseReturn: {
            businessId,
            purchaseOrderId: purchaseOrder.id,
            status: {
              not: SupplierPurchaseReturnStatus.CANCELLED,
            },
          },
        },
        select: {
          productId: true,
          variantId: true,
          quantity: true,
        },
      });
    const returnedQuantityByItem = new Map<string, Prisma.Decimal>();

    for (const item of existingReturnItems) {
      const itemKey = this.inventoryLookup.buildStockItemKey(
        item.productId,
        item.variantId,
      );
      const current =
        returnedQuantityByItem.get(itemKey) ?? new Prisma.Decimal(0);

      returnedQuantityByItem.set(itemKey, current.plus(item.quantity));
    }

    return requestedItems.map((requestedItem) => {
      const itemKey = this.inventoryLookup.buildStockItemKey(
        requestedItem.productId,
        requestedItem.variantId,
      );
      const purchaseOrderItem = purchaseOrderItemMap.get(itemKey);

      if (
        !purchaseOrderItem ||
        purchaseOrderItem.productId !== requestedItem.productId
      ) {
        throw new BadRequestException(
          "One or more purchase return items are invalid",
        );
      }

      const quantity = new Prisma.Decimal(requestedItem.quantity);
      const alreadyReturned =
        returnedQuantityByItem.get(itemKey) ?? new Prisma.Decimal(0);
      const remainingReturnable = new Prisma.Decimal(
        purchaseOrderItem.quantityReceived,
      ).minus(alreadyReturned);

      if (quantity.greaterThan(remainingReturnable)) {
        throw new BadRequestException(
          "Return quantity cannot exceed remaining received quantity",
        );
      }

      const orderedQuantity = new Prisma.Decimal(
        purchaseOrderItem.quantityOrdered,
      );
      const discountPerUnit = new Prisma.Decimal(
        purchaseOrderItem.discountAmount,
      ).div(orderedQuantity);
      const subtotal = quantity.mul(purchaseOrderItem.unitCost);
      const discountAmount = discountPerUnit.mul(quantity).toDecimalPlaces(2);
      const taxableAmount = subtotal.minus(discountAmount);
      const taxAmount = taxableAmount
        .mul(purchaseOrder.taxRate)
        .div(100)
        .toDecimalPlaces(2);

      return {
        productId: requestedItem.productId,
        variantId: requestedItem.variantId ?? null,
        quantity,
        unitCost: purchaseOrderItem.unitCost,
        discountAmount,
        taxAmount,
        lineTotal: taxableAmount.plus(taxAmount),
        reason: requestedItem.reason,
      };
    });
  }

  private calculateReturnTotals(
    items: {
      quantity: Prisma.Decimal;
      unitCost: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      lineTotal: Prisma.Decimal;
    }[],
  ) {
    return items.reduce(
      (totals, item) => ({
        subtotal: totals.subtotal.plus(item.quantity.mul(item.unitCost)),
        discountTotal: totals.discountTotal.plus(item.discountAmount),
        taxTotal: totals.taxTotal.plus(item.taxAmount),
        totalAmount: totals.totalAmount.plus(item.lineTotal),
      }),
      {
        subtotal: new Prisma.Decimal(0),
        discountTotal: new Prisma.Decimal(0),
        taxTotal: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(0),
      },
    );
  }

  private calculateLineTotal(
    item: {
      quantityOrdered: number;
      unitCost: number;
      discountAmount?: number;
    },
    taxRate: Prisma.Decimal.Value,
  ) {
    const subtotal = new Prisma.Decimal(item.quantityOrdered).mul(
      item.unitCost,
    );
    const discountAmount = new Prisma.Decimal(item.discountAmount ?? 0);

    return subtotal
      .minus(discountAmount)
      .plus(this.calculateLineTax(item, taxRate));
  }

  private calculateLineTax(
    item: {
      quantityOrdered: number;
      unitCost: number;
      discountAmount?: number;
    },
    taxRate: Prisma.Decimal.Value,
  ) {
    const subtotal = new Prisma.Decimal(item.quantityOrdered).mul(
      item.unitCost,
    );
    const discountAmount = new Prisma.Decimal(item.discountAmount ?? 0);
    const taxableAmount = subtotal.minus(discountAmount);

    return taxableAmount.mul(taxRate).div(100).toDecimalPlaces(2);
  }

  private normalizeName(value: string) {
    return value.trim();
  }

  private normalizeNullableText(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }

    const normalizedValue = value?.trim();

    return normalizedValue || null;
  }

  private handleUniqueError(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new BadRequestException(message);
    }

    throw error;
  }
}
