import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  InventoryMovementType,
  InventoryReferenceType,
  Prisma,
  SupplierProductMapStatus,
  SupplierPurchaseOrderStatus,
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
import {
  CreatePurchaseOrderDto,
  CreateSupplierDto,
  QueryPurchaseOrderDto,
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
  items: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.SupplierPurchaseOrderInclude;

const ORDER_RECEIVABLE_STATUSES: SupplierPurchaseOrderStatus[] = [
  SupplierPurchaseOrderStatus.ORDERED,
  SupplierPurchaseOrderStatus.PARTIALLY_RECEIVED,
];

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
    await this.inventoryLookup.assertVariantForStock(
      businessId,
      dto.productId,
      dto.variantId,
    );

    try {
      const productMap = await this.prisma.supplierProductMap.create({
        data: {
          businessId,
          supplierId,
          productId: dto.productId,
          variantId: dto.variantId,
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

    await this.inventoryLookup.assertVariantForStock(
      businessId,
      dto.productId ?? existingMap.productId,
      dto.variantId ?? existingMap.variantId,
    );

    try {
      const productMap = await this.prisma.supplierProductMap.update({
        where: { id: productMapId },
        data: {
          ...(dto.productId !== undefined && { productId: dto.productId }),
          ...(dto.variantId !== undefined && { variantId: dto.variantId }),
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
        this.inventoryLookup.assertVariantForStock(
          businessId,
          item.productId,
          item.variantId,
        ),
      ),
    ]);

    const totals = this.calculateOrderTotals(dto.items, dto.shippingCost ?? 0);
    const purchaseOrderNo =
      await this.generateUniquePurchaseOrderNo(businessId);

    try {
      const purchaseOrder = await this.prisma.supplierPurchaseOrder.create({
        data: {
          businessId,
          supplierId: dto.supplierId,
          warehouseId: dto.warehouseId,
          purchaseOrderNo,
          orderDate: dto.orderDate,
          expectedDeliveryDate: dto.expectedDeliveryDate,
          status: dto.status ?? SupplierPurchaseOrderStatus.DRAFT,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          shippingCost: totals.shippingCost,
          totalAmount: totals.totalAmount,
          note: this.normalizeNullableText(dto.note),
          createdBy: currentUser.id,
          items: {
            create: dto.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantityOrdered: item.quantityOrdered,
              unitCost: item.unitCost,
              discountAmount: item.discountAmount ?? 0,
              taxAmount: item.taxAmount ?? 0,
              lineTotal: this.calculateLineTotal(item),
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
      if (
        existingOrder.status === SupplierPurchaseOrderStatus.PARTIALLY_RECEIVED
      ) {
        throw new BadRequestException(
          "Partially received purchase order status is managed by receive action",
        );
      }

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
    if (dto.items.length === 0) {
      throw new BadRequestException("At least one received item is required");
    }

    const purchaseOrder = await this.getPurchaseOrderOrThrow(
      businessId,
      purchaseOrderId,
    );

    if (!ORDER_RECEIVABLE_STATUSES.includes(purchaseOrder.status)) {
      throw new BadRequestException("Purchase order is not receivable");
    }

    const itemMap = new Map(purchaseOrder.items.map((item) => [item.id, item]));

    const duplicateItemIds = new Set<string>();

    for (const receivedItem of dto.items) {
      if (duplicateItemIds.has(receivedItem.purchaseOrderItemId)) {
        throw new BadRequestException("Duplicate received purchase order item");
      }

      duplicateItemIds.add(receivedItem.purchaseOrderItemId);

      const orderItem = itemMap.get(receivedItem.purchaseOrderItemId);

      if (!orderItem) {
        throw new BadRequestException(
          "Received item is not part of this order",
        );
      }

      const nextReceived = new Prisma.Decimal(orderItem.quantityReceived).plus(
        receivedItem.quantityReceived,
      );

      if (nextReceived.greaterThan(orderItem.quantityOrdered)) {
        throw new BadRequestException(
          "Received quantity cannot exceed ordered quantity",
        );
      }
    }

    const receivedOrder = await this.prisma.$transaction(async (tx) => {
      for (const receivedItem of dto.items) {
        const orderItem = itemMap.get(receivedItem.purchaseOrderItemId);

        if (!orderItem) {
          throw new BadRequestException(
            "Received item is not part of this order",
          );
        }

        const quantityReceived = new Prisma.Decimal(
          receivedItem.quantityReceived,
        );

        await tx.supplierPurchaseOrderItem.update({
          where: { id: orderItem.id },
          data: {
            quantityReceived: new Prisma.Decimal(
              orderItem.quantityReceived,
            ).plus(quantityReceived),
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
            businessId_supplierId_variantId: {
              businessId,
              supplierId: purchaseOrder.supplierId,
              variantId: orderItem.variantId,
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
            lastPurchasePrice: orderItem.unitCost,
            status: SupplierProductMapStatus.ACTIVE,
          },
        });
      }

      const updatedItems = await tx.supplierPurchaseOrderItem.findMany({
        where: { purchaseOrderId },
      });

      const isFullyReceived = updatedItems.every((item) =>
        new Prisma.Decimal(item.quantityReceived).greaterThanOrEqualTo(
          item.quantityOrdered,
        ),
      );

      return tx.supplierPurchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          status: isFullyReceived
            ? SupplierPurchaseOrderStatus.RECEIVED
            : SupplierPurchaseOrderStatus.PARTIALLY_RECEIVED,
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

  private assertItems(items: { variantId: string }[]) {
    if (items.length === 0) {
      throw new BadRequestException(
        "At least one purchase order item is required",
      );
    }

    const variantIds = new Set(items.map((item) => item.variantId));

    if (variantIds.size !== items.length) {
      throw new BadRequestException(
        "Purchase order cannot contain duplicate variants",
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
      taxAmount?: number;
    }[],
    shippingCost: number,
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
      (total, item) => total + (item.taxAmount ?? 0),
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

  private calculateLineTotal(item: {
    quantityOrdered: number;
    unitCost: number;
    discountAmount?: number;
    taxAmount?: number;
  }) {
    return (
      item.quantityOrdered * item.unitCost -
      (item.discountAmount ?? 0) +
      (item.taxAmount ?? 0)
    );
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
