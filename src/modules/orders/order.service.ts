import { Injectable } from "@nestjs/common";

import { CreatePosSaleDto } from "../pos/dto/pos-sale.dto";
import { CreateOrderService } from "./application/create-order.service";
import { OrderPaymentService } from "./application/order-payment.service";
import { OrderQueryService } from "./application/order-query.service";
import { OrderReturnService } from "./application/order-return.service";
import { OrderStatusService } from "./application/order-status.service";
import {
  AddOrderPaymentDto,
  CreateOrderDto,
  QueryOrderDto,
  QueryOrderReturnDto,
  UpdateOrderReturnStatusDto,
} from "./dto/order.dto";

import type { CurrentUserPayload } from "../auth/decorators/current-user.decorator";

@Injectable()
export class OrderService {
  constructor(
    private readonly createOrderService: CreateOrderService,
    private readonly orderQueryService: OrderQueryService,
    private readonly orderPaymentService: OrderPaymentService,
    private readonly orderStatusService: OrderStatusService,
    private readonly orderReturnService: OrderReturnService,
  ) {}

  async create(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreateOrderDto,
  ) {
    return this.createOrderService.create(currentUser, businessId, dto);
  }

  async createStorefrontOrder(businessId: string, dto: CreateOrderDto) {
    return this.createOrderService.createStorefrontOrder(businessId, dto);
  }

  async createPosSale(
    currentUser: CurrentUserPayload,
    businessId: string,
    dto: CreatePosSaleDto,
  ) {
    return this.createOrderService.createPosSale(currentUser, businessId, dto);
  }

  async findAll(businessId: string, query: QueryOrderDto) {
    return this.orderQueryService.findAll(businessId, query);
  }

  async findOne(businessId: string, orderId: string) {
    return this.orderQueryService.findOne(businessId, orderId);
  }

  async findReturns(businessId: string, query: QueryOrderReturnDto) {
    return this.orderReturnService.findAll(businessId, query);
  }

  async findReturn(businessId: string, returnId: string) {
    return this.orderReturnService.findOne(businessId, returnId);
  }

  async updateReturnStatus(
    currentUser: CurrentUserPayload,
    businessId: string,
    returnId: string,
    dto: UpdateOrderReturnStatusDto,
  ) {
    return this.orderReturnService.updateStatus(
      currentUser,
      businessId,
      returnId,
      dto,
    );
  }

  async addPayment(
    currentUser: CurrentUserPayload,
    businessId: string,
    orderId: string,
    dto: AddOrderPaymentDto,
  ) {
    return this.orderPaymentService.addPayment(
      currentUser,
      businessId,
      orderId,
      dto,
    );
  }

  async ship(
    currentUser: CurrentUserPayload,
    businessId: string,
    orderId: string,
  ) {
    return this.orderStatusService.ship(currentUser, businessId, orderId);
  }

  async deliver(
    currentUser: CurrentUserPayload,
    businessId: string,
    orderId: string,
  ) {
    return this.orderStatusService.deliver(currentUser, businessId, orderId);
  }

  async cancel(
    currentUser: CurrentUserPayload,
    businessId: string,
    orderId: string,
  ) {
    return this.orderStatusService.cancel(currentUser, businessId, orderId);
  }

  async cancelByCustomer(
    businessId: string,
    orderId: string,
    note?: string | null,
  ) {
    return this.orderStatusService.cancelByCustomer(businessId, orderId, note);
  }
}
