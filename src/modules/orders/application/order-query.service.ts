import { Injectable, NotFoundException } from "@nestjs/common";

import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import { OrderRepository } from "../infrastructure/order.repository";

import type { QueryOrderDto } from "../dto/order.dto";

@Injectable()
export class OrderQueryService {
  constructor(private readonly orders: OrderRepository) {}

  async findAll(businessId: string, query: QueryOrderDto) {
    const { items, meta } = await this.orders.findPaginated(businessId, query);

    return paginatedResponse(
      items,
      meta,
      "Orders were loaded successfully. The response includes the requested page of orders for this business and pagination metadata for browsing more results.",
    );
  }

  async findOne(businessId: string, orderId: string) {
    const order = await this.orders.findById(businessId, orderId);

    if (!order) {
      throw new NotFoundException(
        "Order could not be found. It may not exist, may have been deleted, or may not belong to the current business or customer account.",
      );
    }

    return apiResponse(order);
  }
}
