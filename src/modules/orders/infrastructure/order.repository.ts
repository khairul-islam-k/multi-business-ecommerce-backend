import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { QueryOrderDto } from "../dto/order.dto";
import { ORDER_INCLUDE } from "./order.selects";

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPaginated(businessId: string, query: QueryOrderDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderOrderWhereInput = {
      businessId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
      ...(query.orderType ? { orderType: query.orderType } : {}),
      ...(query.search
        ? {
            OR: [
              { orderNo: { contains: query.search, mode: "insensitive" } },
              {
                customerName: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
              {
                customerPhone: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.orderOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: ORDER_INCLUDE,
      }),
      this.prisma.orderOrder.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(businessId: string, orderId: string) {
    return this.prisma.orderOrder.findFirst({
      where: { id: orderId, businessId, deletedAt: null },
      include: ORDER_INCLUDE,
    });
  }

  async getByIdOrThrow(businessId: string, orderId: string) {
    const order = await this.prisma.orderOrder.findFirst({
      where: { id: orderId, businessId, deletedAt: null },
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return order;
  }
}
