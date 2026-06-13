import { Injectable } from "@nestjs/common";
import { Prisma, SupplierStatus } from "@prisma/client";

import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import { PrismaService } from "../../../prisma/prisma.service";
import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import {
  CreateSupplierDto,
  QuerySupplierDto,
  UpdateSupplierDto,
} from "../dto/supplier.dto";
import {
  normalizeNullableText,
  normalizeSupplierName,
} from "../domain/supplier-contact.policy";
import { SupplierRepository } from "../infrastructure/supplier.repository";
import { SUPPLIER_INCLUDE } from "../infrastructure/supplier.selects";

@Injectable()
export class SupplierCrudService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly suppliers: SupplierRepository,
  ) {}

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreateSupplierDto,
  ) {
    const supplier = await this.prisma.supplier.create({
      data: {
        businessId,
        name: normalizeSupplierName(dto.name),
        companyName: normalizeNullableText(dto.companyName),
        email: normalizeNullableText(dto.email),
        phone: normalizeNullableText(dto.phone),
        address: normalizeNullableText(dto.address),
        city: normalizeNullableText(dto.city),
        country: normalizeNullableText(dto.country),
        status: dto.status ?? SupplierStatus.ACTIVE,
        note: normalizeNullableText(dto.note),
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
      await this.suppliers.assertSupplierExists(businessId, supplierId);
    }

    return apiResponse(supplier);
  }

  async update(
    currentUser: CurrentUserPayload,
    businessId: string,
    supplierId: string,
    dto: UpdateSupplierDto,
  ) {
    await this.suppliers.assertSupplierExists(businessId, supplierId);

    const supplier = await this.prisma.supplier.update({
      where: { id: supplierId },
      data: {
        ...(dto.name !== undefined && {
          name: normalizeSupplierName(dto.name),
        }),
        ...(dto.companyName !== undefined && {
          companyName: normalizeNullableText(dto.companyName),
        }),
        ...(dto.email !== undefined && {
          email: normalizeNullableText(dto.email),
        }),
        ...(dto.phone !== undefined && {
          phone: normalizeNullableText(dto.phone),
        }),
        ...(dto.address !== undefined && {
          address: normalizeNullableText(dto.address),
        }),
        ...(dto.city !== undefined && {
          city: normalizeNullableText(dto.city),
        }),
        ...(dto.country !== undefined && {
          country: normalizeNullableText(dto.country),
        }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.note !== undefined && {
          note: normalizeNullableText(dto.note),
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
    await this.suppliers.assertSupplierExists(businessId, supplierId);
    await this.suppliers.assertSupplierCanBeDeleted(businessId, supplierId);

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
}
