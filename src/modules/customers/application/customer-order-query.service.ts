import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { getPagination } from "../../../common/http/pagination.util";
import {
  resolveSort,
  resolveSortDirection,
} from "../../../common/http/sort.util";
import { paginatedResponse } from "../../../common/utils/api-response.util";
import {
  CustomerOrderSortBy,
  CustomerSortOrder,
  QueryCustomerOrderDto,
} from "../dto/customer.dto";
import { CustomerRepository } from "../infrastructure/customer.repository";

const CUSTOMER_ORDER_SORTS = Object.values(CustomerOrderSortBy);

@Injectable()
export class CustomerOrderQueryService {
  constructor(private readonly customers: CustomerRepository) {}

  async findOrders(
    businessId: string,
    customerId: string,
    query: QueryCustomerOrderDto,
  ) {
    await this.getCustomerOrThrow(businessId, customerId);

    const pagination = getPagination(query);
    const sortBy = resolveSort(
      query.sortBy,
      CUSTOMER_ORDER_SORTS,
      CustomerOrderSortBy.CREATED_AT,
    );
    const sortOrder = resolveSortDirection(
      query.sortOrder,
      CustomerSortOrder.DESC,
    );

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

    const orderBy: Prisma.OrderOrderOrderByWithRelationInput[] = [
      { [sortBy]: sortOrder },
      { createdAt: "desc" },
    ];

    const [items, total] = await this.customers.findOrdersPage({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy,
    });

    return paginatedResponse(items, pagination.meta(total));
  }

  private async getCustomerOrThrow(businessId: string, customerId: string) {
    const customer = await this.customers.findById(businessId, customerId);

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    return customer;
  }
}
