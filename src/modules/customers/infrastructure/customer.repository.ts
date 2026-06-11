import { Injectable } from "@nestjs/common";
import { OrderCustomerStatus, Prisma } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { CUSTOMER_INCLUDE, CUSTOMER_ORDER_INCLUDE } from "./customer.selects";

@Injectable()
export class CustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(callback);
  }

  create(data: Prisma.OrderCustomerUncheckedCreateInput) {
    return this.prisma.orderCustomer.create({
      data,
      include: CUSTOMER_INCLUDE,
    });
  }

  findById(businessId: string, customerId: string) {
    return this.prisma.orderCustomer.findFirst({
      where: { id: customerId, businessId, deletedAt: null },
      include: CUSTOMER_INCLUDE,
    });
  }

  findPage(args: {
    where: Prisma.OrderCustomerWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.OrderCustomerOrderByWithRelationInput[];
  }) {
    return Promise.all([
      this.prisma.orderCustomer.findMany({
        where: args.where,
        skip: args.skip,
        take: args.take,
        orderBy: args.orderBy,
        include: CUSTOMER_INCLUDE,
      }),
      this.prisma.orderCustomer.count({ where: args.where }),
    ]);
  }

  update(customerId: string, data: Prisma.OrderCustomerUncheckedUpdateInput) {
    return this.prisma.orderCustomer.update({
      where: { id: customerId },
      data,
      include: CUSTOMER_INCLUDE,
    });
  }

  softDeleteCustomer(
    tx: Prisma.TransactionClient,
    customerId: string,
    userId: string,
    deletedAt: Date,
  ) {
    return tx.orderCustomer.update({
      where: { id: customerId },
      data: {
        status: OrderCustomerStatus.INACTIVE,
        deletedAt,
        updatedBy: userId,
      },
    });
  }

  softDeleteAddresses(
    tx: Prisma.TransactionClient,
    customerId: string,
    deletedAt: Date,
  ) {
    return tx.orderCustomerAddress.updateMany({
      where: { customerId, deletedAt: null },
      data: { deletedAt },
    });
  }

  findExistingContact(
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
      return Promise.resolve(null);
    }

    return this.prisma.orderCustomer.findFirst({
      where: {
        businessId,
        deletedAt: null,
        OR: conditions,
        ...(excludeCustomerId ? { id: { not: excludeCustomerId } } : {}),
      },
      select: { id: true },
    });
  }

  countAddresses(customerId: string) {
    return this.prisma.orderCustomerAddress.count({
      where: { customerId, deletedAt: null },
    });
  }

  unsetDefaultAddresses(
    tx: Prisma.TransactionClient,
    customerId: string,
    excludeAddressId?: string,
  ) {
    return tx.orderCustomerAddress.updateMany({
      where: {
        customerId,
        deletedAt: null,
        isDefault: true,
        ...(excludeAddressId ? { id: { not: excludeAddressId } } : {}),
      },
      data: { isDefault: false },
    });
  }

  createAddress(
    tx: Prisma.TransactionClient,
    data: Prisma.OrderCustomerAddressUncheckedCreateInput,
  ) {
    return tx.orderCustomerAddress.create({ data });
  }

  findAddresses(customerId: string) {
    return this.prisma.orderCustomerAddress.findMany({
      where: { customerId, deletedAt: null },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  }

  findAddressById(customerId: string, addressId: string) {
    return this.prisma.orderCustomerAddress.findFirst({
      where: { id: addressId, customerId, deletedAt: null },
    });
  }

  updateAddress(
    tx: Prisma.TransactionClient,
    addressId: string,
    data: Prisma.OrderCustomerAddressUncheckedUpdateInput,
  ) {
    return tx.orderCustomerAddress.update({
      where: { id: addressId },
      data,
    });
  }

  findNextDefaultAddress(tx: Prisma.TransactionClient, customerId: string) {
    return tx.orderCustomerAddress.findFirst({
      where: { customerId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
  }

  findOrdersPage(args: {
    where: Prisma.OrderOrderWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.OrderOrderOrderByWithRelationInput[];
  }) {
    return Promise.all([
      this.prisma.orderOrder.findMany({
        where: args.where,
        skip: args.skip,
        take: args.take,
        orderBy: args.orderBy,
        include: CUSTOMER_ORDER_INCLUDE,
      }),
      this.prisma.orderOrder.count({ where: args.where }),
    ]);
  }
}
