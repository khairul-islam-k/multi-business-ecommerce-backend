import { Injectable } from "@nestjs/common";
import { SupplierStatus, supplier } from "@/database/schema";
import { and, asc, count, desc, eq, ilike, isNull, or } from "drizzle-orm";

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
import { DatabaseService } from "../../../database/database.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";

@Injectable()
export class SupplierCrudService {
  constructor(
    private readonly database: DatabaseService,
    private readonly suppliers: SupplierRepository,
  ) {}

  private get db() {
    return this.database.db;
  }

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreateSupplierDto,
  ) {
    const [createdSupplier] = await this.db
      .insert(supplier)
      .values({
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
      })
      .returning();

    return apiResponse(
      await this.suppliers.withCounts(createdSupplier),
      "Supplier created successfully",
    );
  }

  async findAll(businessId: string, query: QuerySupplierDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = and(
      eq(supplier.businessId, businessId),
      isNull(supplier.deletedAt),
      query.status ? eq(supplier.status, query.status) : undefined,
      query.search
        ? or(
            ilike(supplier.name, `%${query.search}%`),
            ilike(supplier.companyName, `%${query.search}%`),
            ilike(supplier.email, `%${query.search}%`),
            ilike(supplier.phone, `%${query.search}%`),
          )
        : undefined,
    );

    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(supplier)
        .where(where)
        .orderBy(
          query.sortOrder === "asc"
            ? asc(supplier.createdAt)
            : desc(supplier.createdAt),
        )
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(supplier)
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);
    const items = await Promise.all(
      rows.map((supplierRow) => this.suppliers.withCounts(supplierRow)),
    );

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findOne(businessId: string, supplierId: string) {
    const [supplierRow] = await this.db
      .select()
      .from(supplier)
      .where(
        and(
          eq(supplier.id, supplierId),
          eq(supplier.businessId, businessId),
          isNull(supplier.deletedAt),
        ),
      );

    if (!supplierRow) {
      await this.suppliers.assertSupplierExists(businessId, supplierId);
    }

    return apiResponse(
      supplierRow ? await this.suppliers.withCounts(supplierRow) : null,
    );
  }

  async update(
    currentUser: CurrentUserPayload,
    businessId: string,
    supplierId: string,
    dto: UpdateSupplierDto,
  ) {
    await this.suppliers.assertSupplierExists(businessId, supplierId);

    const [updatedSupplier] = await this.db
      .update(supplier)
      .set({
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
      })
      .where(eq(supplier.id, supplierId))
      .returning();

    return apiResponse(
      await this.suppliers.withCounts(updatedSupplier),
      "Supplier updated successfully",
    );
  }

  async remove(
    currentUser: CurrentUserPayload,
    businessId: string,
    supplierId: string,
  ) {
    await this.suppliers.assertSupplierExists(businessId, supplierId);
    await this.suppliers.assertSupplierCanBeDeleted(businessId, supplierId);

    await this.db
      .update(supplier)
      .set({
        status: SupplierStatus.INACTIVE,
        deletedAt: new Date(),
        updatedBy: currentUser.id,
      })
      .where(eq(supplier.id, supplierId));

    return apiResponse(null, "Supplier deleted successfully");
  }
}
