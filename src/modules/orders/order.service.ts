import { Injectable } from "@nestjs/common";

import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { CreatePosSaleDto } from "../pos/dto/pos-sale.dto";
import { CreateOrderService } from "./application/create-order.service";
import { OrderPaymentService } from "./application/order-payment.service";
import { OrderQueryService } from "./application/order-query.service";
import { OrderStatusService } from "./application/order-status.service";
import {
  AddOrderPaymentDto,
  CreateOrderDto,
  QueryOrderDto,
} from "./dto/order.dto";

@Injectable()
export class OrderService {
  constructor(
    private readonly createOrders: CreateOrderService,
    private readonly queries: OrderQueryService,
    private readonly payments: OrderPaymentService,
    private readonly statuses: OrderStatusService,
  ) {}

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreateOrderDto,
  ) {
    return this.createOrders.create(currentUser, businessId, dto);
  }

  async createPosSale(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreatePosSaleDto,
  ) {
    return this.createOrders.createPosSale(currentUser, businessId, dto);
  }

  async findAll(businessId: string, query: QueryOrderDto) {
    return this.queries.findAll(businessId, query);
  }

  async findOne(businessId: string, orderId: string) {
    return this.queries.findOne(businessId, orderId);
  }

  async addPayment(
    currentUser: CurrentUserPayload,
    businessId: string,
    orderId: string,
    dto: AddOrderPaymentDto,
  ) {
    return this.payments.addPayment(currentUser, businessId, orderId, dto);
  }

  async ship(
    currentUser: CurrentUserPayload,
    businessId: string,
    orderId: string,
  ) {
    return this.statuses.ship(currentUser, businessId, orderId);
  }

  async deliver(
    currentUser: CurrentUserPayload,
    businessId: string,
    orderId: string,
  ) {
    return this.statuses.deliver(currentUser, businessId, orderId);
  }

  async cancel(
    currentUser: CurrentUserPayload,
    businessId: string,
    orderId: string,
  ) {
    return this.statuses.cancel(currentUser, businessId, orderId);
  }
}
