import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { FinanceTaxStatus, Prisma } from "@prisma/client";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";
import {
  CreateFinanceTaxDto,
  QueryFinanceTaxDto,
  UpdateFinanceTaxDto,
} from "./dto/finance-tax.dto";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";

@Injectable()
export class FinanceTaxService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreateFinanceTaxDto,
  ) {
    try {
      const tax = await this.prisma.financeTax.create({
        data: {
          businessId,
          name: this.normalizeName(dto.name),
          rate: dto.rate,
          description: this.normalizeNullableText(dto.description),
          status: dto.status ?? FinanceTaxStatus.ACTIVE,
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
        },
      });

      return apiResponse(tax, "Tax created successfully");
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findAll(businessId: string, query: QueryFinanceTaxDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.FinanceTaxWhereInput = {
      businessId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              {
                description: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.financeTax.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.financeTax.count({ where }),
    ]);

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findOne(businessId: string, taxId: string) {
    const tax = await this.prisma.financeTax.findFirst({
      where: { id: taxId, businessId, deletedAt: null },
    });

    if (!tax) {
      throw new NotFoundException("Tax not found");
    }

    return apiResponse(tax);
  }

  async update(
    currentUser: CurrentUserPayload,
    businessId: string,
    taxId: string,
    dto: UpdateFinanceTaxDto,
  ) {
    await this.assertTaxExists(businessId, taxId);

    try {
      const tax = await this.prisma.financeTax.update({
        where: { id: taxId },
        data: {
          ...(dto.name !== undefined && { name: this.normalizeName(dto.name) }),
          ...(dto.rate !== undefined && { rate: dto.rate }),
          ...(dto.description !== undefined && {
            description: this.normalizeNullableText(dto.description),
          }),
          ...(dto.status !== undefined && { status: dto.status }),
          updatedBy: currentUser.id,
        },
      });

      return apiResponse(tax, "Tax updated successfully");
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async remove(
    currentUser: CurrentUserPayload,
    businessId: string,
    taxId: string,
  ) {
    await this.assertTaxExists(businessId, taxId);

    await this.prisma.financeTax.update({
      where: { id: taxId },
      data: {
        status: FinanceTaxStatus.INACTIVE,
        deletedAt: new Date(),
        updatedBy: currentUser.id,
      },
    });

    return apiResponse(null, "Tax deleted successfully");
  }

  private async assertTaxExists(businessId: string, taxId: string) {
    const tax = await this.prisma.financeTax.findFirst({
      where: { id: taxId, businessId, deletedAt: null },
      select: { id: true },
    });

    if (!tax) {
      throw new NotFoundException("Tax not found");
    }
  }

  private normalizeName(value: string) {
    const normalized = value.trim();

    if (!normalized) {
      throw new BadRequestException("Tax name is required");
    }

    return normalized;
  }

  private normalizeNullableText(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }

    const normalizedValue = value?.trim();

    return normalizedValue || null;
  }

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException("Tax name already exists");
    }

    throw error;
  }
}
