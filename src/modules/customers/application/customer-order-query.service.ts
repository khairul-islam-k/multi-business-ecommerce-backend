import { Injectable, NotFoundException } from "@nestjs/common";

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

    const where = {
      businessId,
      customerId,
      status: query.status,
      paymentStatus: query.paymentStatus,
      search: query.search,
    };

    const orderBy = [
      { field: sortBy, direction: sortOrder },
      {
        field: CustomerOrderSortBy.CREATED_AT,
        direction: CustomerSortOrder.DESC,
      },
    ];

    const [items, total] = await this.customers.findOrdersPage({
      where,
      skip: pagination.skip,
      take: pagination.limit,
      orderBy,
    });

    return paginatedResponse(
      items,
      pagination.meta(total),
      "Customer orders were loaded successfully. The response includes the requested page of orders for this customer and pagination metadata for browsing more results.",
    );
  }

  private async getCustomerOrThrow(businessId: string, customerId: string) {
    const customer = await this.customers.findById(businessId, customerId);

    if (!customer) {
      throw new NotFoundException(
        "Customer could not be found. It may not exist, may have been deleted, or may not belong to the current business or storefront.",
      );
    }

    return customer;
  }
}
