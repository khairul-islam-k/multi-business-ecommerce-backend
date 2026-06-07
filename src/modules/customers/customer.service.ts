import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { OrderAddressType, OrderCustomerStatus, Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import {
  apiResponse,
  paginatedResponse,
} from "../../common/utils/api-response.util";
import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import {
  CreateCustomerDto,
  CustomerAddressDto,
  QueryCustomerDto,
  QueryCustomerOrderDto,
  UpdateCustomerAddressDto,
  UpdateCustomerDto,
} from "./dto/customer.dto";

const CUSTOMER_INCLUDE = {
  addresses: {
    where: { deletedAt: null },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  },
  _count: {
    select: {
      carts: true,
      orders: true,
    },
  },
} satisfies Prisma.OrderCustomerInclude;

const CUSTOMER_ORDER_INCLUDE = {
  items: { orderBy: { createdAt: "asc" } },
  payments: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.OrderOrderInclude;

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreateCustomerDto,
  ) {
    const email = this.normalizeEmail(dto.email);
    const phone = this.normalizeNullableText(dto.phone);

    await this.assertContactAvailable(businessId, { email, phone });

    const customer = await this.prisma.orderCustomer.create({
      data: {
        businessId,
        name: this.normalizeName(dto.name),
        email,
        phone,
        status: dto.status ?? OrderCustomerStatus.ACTIVE,
        note: this.normalizeNullableText(dto.note),
        createdBy: currentUser.id,
        updatedBy: currentUser.id,
      },
      include: CUSTOMER_INCLUDE,
    });

    return apiResponse(customer, "Customer created successfully");
  }

  async findAll(businessId: string, query: QueryCustomerDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ?? "createdAt";
    const sortOrder = query.sortOrder ?? "desc";

    const where: Prisma.OrderCustomerWhereInput = {
      businessId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
              { phone: { contains: query.search, mode: "insensitive" } },
              { note: { contains: query.search, mode: "insensitive" } },
              {
                addresses: {
                  some: {
                    deletedAt: null,
                    OR: [
                      {
                        address: {
                          contains: query.search,
                          mode: "insensitive",
                        },
                      },
                      { city: { contains: query.search, mode: "insensitive" } },
                      {
                        country: {
                          contains: query.search,
                          mode: "insensitive",
                        },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.orderCustomer.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ [sortBy]: sortOrder }, { createdAt: "desc" }],
        include: CUSTOMER_INCLUDE,
      }),
      this.prisma.orderCustomer.count({ where }),
    ]);

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  async findOne(businessId: string, customerId: string) {
    return apiResponse(await this.getCustomerOrThrow(businessId, customerId));
  }

  async update(
    currentUser: CurrentUserPayload,
    businessId: string,
    customerId: string,
    dto: UpdateCustomerDto,
  ) {
    await this.getCustomerOrThrow(businessId, customerId);

    const email =
      dto.email !== undefined ? this.normalizeEmail(dto.email) : undefined;
    const phone =
      dto.phone !== undefined
        ? this.normalizeNullableText(dto.phone)
        : undefined;

    if (email !== undefined || phone !== undefined) {
      await this.assertContactAvailable(
        businessId,
        { email, phone },
        customerId,
      );
    }

    const customer = await this.prisma.orderCustomer.update({
      where: { id: customerId },
      data: {
        ...(dto.name !== undefined && { name: this.normalizeName(dto.name) }),
        ...(dto.email !== undefined && { email }),
        ...(dto.phone !== undefined && { phone }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.note !== undefined && {
          note: this.normalizeNullableText(dto.note),
        }),
        updatedBy: currentUser.id,
      },
      include: CUSTOMER_INCLUDE,
    });

    return apiResponse(customer, "Customer updated successfully");
  }

  async remove(
    currentUser: CurrentUserPayload,
    businessId: string,
    customerId: string,
  ) {
    await this.getCustomerOrThrow(businessId, customerId);

    await this.prisma.$transaction(async (tx) => {
      await tx.orderCustomerAddress.updateMany({
        where: { customerId, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      await tx.orderCustomer.update({
        where: { id: customerId },
        data: {
          status: OrderCustomerStatus.INACTIVE,
          deletedAt: new Date(),
          updatedBy: currentUser.id,
        },
      });
    });

    return apiResponse(null, "Customer deleted successfully");
  }

  async createAddress(
    businessId: string,
    customerId: string,
    dto: CustomerAddressDto,
  ) {
    await this.getCustomerOrThrow(businessId, customerId);

    const shouldBeDefault =
      dto.isDefault === true ||
      (await this.prisma.orderCustomerAddress.count({
        where: { customerId, deletedAt: null },
      })) === 0;

    const address = await this.prisma.$transaction(async (tx) => {
      if (shouldBeDefault) {
        await tx.orderCustomerAddress.updateMany({
          where: { customerId, deletedAt: null, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.orderCustomerAddress.create({
        data: {
          customerId,
          addressType: dto.addressType ?? OrderAddressType.HOME,
          name: this.normalizeNullableText(dto.name),
          address: this.normalizeName(dto.address),
          city: this.normalizeNullableText(dto.city),
          country: this.normalizeNullableText(dto.country),
          isDefault: shouldBeDefault,
        },
      });
    });

    return apiResponse(address, "Customer address created successfully");
  }

  async findAddresses(businessId: string, customerId: string) {
    await this.getCustomerOrThrow(businessId, customerId);

    const addresses = await this.prisma.orderCustomerAddress.findMany({
      where: { customerId, deletedAt: null },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    return apiResponse(addresses);
  }

  async updateAddress(
    businessId: string,
    customerId: string,
    addressId: string,
    dto: UpdateCustomerAddressDto,
  ) {
    await this.getAddressOrThrow(businessId, customerId, addressId);

    const address = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.orderCustomerAddress.updateMany({
          where: {
            customerId,
            deletedAt: null,
            isDefault: true,
            id: { not: addressId },
          },
          data: { isDefault: false },
        });
      }

      return tx.orderCustomerAddress.update({
        where: { id: addressId },
        data: {
          ...(dto.addressType !== undefined && {
            addressType: dto.addressType,
          }),
          ...(dto.name !== undefined && {
            name: this.normalizeNullableText(dto.name),
          }),
          ...(dto.address !== undefined && {
            address: this.normalizeName(dto.address),
          }),
          ...(dto.city !== undefined && {
            city: this.normalizeNullableText(dto.city),
          }),
          ...(dto.country !== undefined && {
            country: this.normalizeNullableText(dto.country),
          }),
          ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
        },
      });
    });

    return apiResponse(address, "Customer address updated successfully");
  }

  async removeAddress(
    businessId: string,
    customerId: string,
    addressId: string,
  ) {
    const existingAddress = await this.getAddressOrThrow(
      businessId,
      customerId,
      addressId,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.orderCustomerAddress.update({
        where: { id: addressId },
        data: {
          isDefault: false,
          deletedAt: new Date(),
        },
      });

      if (existingAddress.isDefault) {
        const nextDefault = await tx.orderCustomerAddress.findFirst({
          where: { customerId, deletedAt: null },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });

        if (nextDefault) {
          await tx.orderCustomerAddress.update({
            where: { id: nextDefault.id },
            data: { isDefault: true },
          });
        }
      }
    });

    return apiResponse(null, "Customer address deleted successfully");
  }

  async findOrders(
    businessId: string,
    customerId: string,
    query: QueryCustomerOrderDto,
  ) {
    await this.getCustomerOrThrow(businessId, customerId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ?? "createdAt";
    const sortOrder = query.sortOrder ?? "desc";

    const where: Prisma.OrderOrderWhereInput = {
      businessId,
      customerId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
      ...(query.search
        ? {
            OR: [
              { orderNo: { contains: query.search, mode: "insensitive" } },
              { note: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.orderOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ [sortBy]: sortOrder }, { createdAt: "desc" }],
        include: CUSTOMER_ORDER_INCLUDE,
      }),
      this.prisma.orderOrder.count({ where }),
    ]);

    return paginatedResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  private async getCustomerOrThrow(businessId: string, customerId: string) {
    const customer = await this.prisma.orderCustomer.findFirst({
      where: { id: customerId, businessId, deletedAt: null },
      include: CUSTOMER_INCLUDE,
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    return customer;
  }

  private async getAddressOrThrow(
    businessId: string,
    customerId: string,
    addressId: string,
  ) {
    await this.getCustomerOrThrow(businessId, customerId);

    const address = await this.prisma.orderCustomerAddress.findFirst({
      where: { id: addressId, customerId, deletedAt: null },
    });

    if (!address) {
      throw new NotFoundException("Customer address not found");
    }

    return address;
  }

  private async assertContactAvailable(
    businessId: string,
    contact: { email?: string | null; phone?: string | null },
    excludeCustomerId?: string,
  ) {
    const conditions: Prisma.OrderCustomerWhereInput[] = [];

    if (contact.email) {
      conditions.push({ email: contact.email });
    }

    if (contact.phone) {
      conditions.push({ phone: contact.phone });
    }

    if (conditions.length === 0) {
      return;
    }

    const existingCustomer = await this.prisma.orderCustomer.findFirst({
      where: {
        businessId,
        deletedAt: null,
        OR: conditions,
        ...(excludeCustomerId ? { id: { not: excludeCustomerId } } : {}),
      },
      select: { id: true },
    });

    if (existingCustomer) {
      throw new BadRequestException(
        "Customer with this email or phone already exists for this business",
      );
    }
  }

  private normalizeName(value: string) {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      throw new BadRequestException("Value cannot be empty");
    }

    return normalizedValue;
  }

  private normalizeEmail(value?: string | null) {
    const normalizedValue = value?.trim().toLowerCase();

    return normalizedValue || null;
  }

  private normalizeNullableText(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }

    const normalizedValue = value?.trim();

    return normalizedValue || null;
  }
}
