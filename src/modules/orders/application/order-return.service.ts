import { and, asc, count, desc, eq, ilike, isNull, or } from "drizzle-orm";

import {
  customer,
  InventoryMovementType,
  InventoryReferenceType,
  order,
  orderItem,
  orderReturn,
  orderReturnItem,
  OrderReturnStatus,
} from "@/database/schema";
import { FinanceLedgerService } from "@/modules/finance/common/finance-ledger.service";
import { InventoryLookupService } from "@/modules/inventory/common/inventory-lookup.service";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  apiResponse,
  paginatedResponse,
} from "../../../common/utils/api-response.util";
import { DatabaseService } from "../../../database/database.service";
import {
  QueryOrderReturnDto,
  UpdateOrderReturnStatusDto,
} from "../dto/order.dto";

import type { CurrentUserPayload } from "../../auth/decorators/current-user.decorator";

@Injectable()
export class OrderReturnService {
  constructor(
    private readonly database: DatabaseService,
    private readonly finance: FinanceLedgerService,
    private readonly inventoryLookup: InventoryLookupService,
  ) {}

  private get db() {
    return this.database.db;
  }

  async findAll(businessId: string, query: QueryOrderReturnDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();
    const where = and(
      eq(orderReturn.businessId, businessId),
      isNull(orderReturn.deletedAt),
      isNull(order.deletedAt),
      query.status ? eq(orderReturn.status, query.status) : undefined,
      query.orderId ? eq(orderReturn.orderId, query.orderId) : undefined,
      search
        ? or(
            ilike(orderReturn.returnNo, `%${search}%`),
            ilike(orderReturn.reason, `%${search}%`),
            ilike(order.orderNo, `%${search}%`),
          )
        : undefined,
    );

    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(orderReturn)
        .innerJoin(order, eq(order.id, orderReturn.orderId))
        .where(where)
        .orderBy(desc(orderReturn.createdAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ value: count() })
        .from(orderReturn)
        .innerJoin(order, eq(order.id, orderReturn.orderId))
        .where(where)
        .then(([row]) => row?.value ?? 0),
    ]);

    return paginatedResponse(
      await Promise.all(
        rows.map((row) => this.hydrateReturn(row.order_returns)),
      ),
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    );
  }

  async findOne(businessId: string, returnId: string) {
    const returnRow = await this.getReturnOrThrow(businessId, returnId);

    return apiResponse(await this.hydrateReturn(returnRow));
  }

  async updateStatus(
    currentUser: CurrentUserPayload,
    businessId: string,
    returnId: string,
    dto: UpdateOrderReturnStatusDto,
  ) {
    const returnRow = await this.getReturnOrThrow(businessId, returnId);
    this.assertReturnStatusTransition(returnRow.status, dto.status);

    const updatedReturn = await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(orderReturn)
        .set({
          status: dto.status,
          approvedBy:
            dto.status === OrderReturnStatus.APPROVED
              ? currentUser.id
              : returnRow.approvedBy,
          approvedAt:
            dto.status === OrderReturnStatus.APPROVED
              ? new Date()
              : returnRow.approvedAt,
        })
        .where(eq(orderReturn.id, returnRow.id))
        .returning();

      const updatedReturn = await this.hydrateReturn(updated);

      if (dto.status === OrderReturnStatus.APPROVED) {
        await this.finance.createCustomerReturnPayable(tx, {
          businessId,
          // TODO: why so many baaaangs!!!!
          customerId: updatedReturn.order!.customerId!,
          returnId: updatedReturn.id,
          totalAmount: updatedReturn.totalAmount,
          // TODO: consider adding a note in here
        });
      }

      if (dto.status === OrderReturnStatus.COMPLETED) {
        await Promise.all(
          updatedReturn.items.map(async (item) => {
            await this.inventoryLookup.applyStockDelta(tx, {
              businessId,
              movementType: InventoryMovementType.SALE_RETURN_IN,
              productId: item.productId,
              variantId: item.variantId,
              quantityDelta: item.quantity,
              // TODO: why so bang!!!
              warehouseId: updatedReturn.order!.warehouseId!,
              referenceId: updatedReturn.id,
              referenceType: InventoryReferenceType.ORDER_RETURN,
              createdBy: currentUser.id,
              note: updatedReturn.reason,
            });
          }),
        );
      }

      return updatedReturn;
    });

    return apiResponse(
      updatedReturn,
      "Order return status updated successfully",
    );
  }

  private async getReturnOrThrow(businessId: string, returnId: string) {
    const [returnRow] = await this.db
      .select()
      .from(orderReturn)
      .where(
        and(
          eq(orderReturn.id, returnId),
          eq(orderReturn.businessId, businessId),
          isNull(orderReturn.deletedAt),
        ),
      )
      .limit(1);

    if (!returnRow) {
      throw new NotFoundException("Order return not found");
    }

    return returnRow;
  }

  private async hydrateReturn(returnRow: typeof orderReturn.$inferSelect) {
    const [orderRow, items] = await Promise.all([
      this.db
        .select({
          order,
          customer,
        })
        .from(order)
        .leftJoin(customer, eq(customer.id, order.customerId))
        .where(eq(order.id, returnRow.orderId))
        .then(([row]) =>
          row
            ? {
                ...row.order,
                customer: row.customer,
              }
            : null,
        ),
      this.db
        .select({
          returnItem: orderReturnItem,
          orderItem,
        })
        .from(orderReturnItem)
        .innerJoin(orderItem, eq(orderItem.id, orderReturnItem.orderItemId))
        .where(eq(orderReturnItem.returnId, returnRow.id))
        .orderBy(asc(orderReturnItem.createdAt)),
    ]);

    return {
      ...returnRow,
      order: orderRow,
      items: items.map((row) => ({
        ...row.returnItem,
        orderItem: row.orderItem,
      })),
    };
  }

  private assertReturnStatusTransition(
    currentStatus: OrderReturnStatus,
    nextStatus: OrderReturnStatus,
  ) {
    if (currentStatus === nextStatus) {
      throw new BadRequestException(
        `This return is already ${currentStatus.toLowerCase()}. Choose a different status to continue.`,
      );
    }

    const allowedTransitions: Record<OrderReturnStatus, OrderReturnStatus[]> = {
      [OrderReturnStatus.REQUESTED]: [
        OrderReturnStatus.APPROVED,
        OrderReturnStatus.REJECTED,
        OrderReturnStatus.CANCELLED,
      ],
      [OrderReturnStatus.APPROVED]: [
        OrderReturnStatus.COMPLETED,
        OrderReturnStatus.CANCELLED,
      ],
      [OrderReturnStatus.REJECTED]: [],
      [OrderReturnStatus.COMPLETED]: [],
      [OrderReturnStatus.CANCELLED]: [],
    };
    const allowed = allowedTransitions[currentStatus];

    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(
        `This return cannot move from ${currentStatus.toLowerCase()} to ${nextStatus.toLowerCase()}. Allowed next statuses: ${
          allowed.length === 0
            ? "none, because this return is already closed"
            : allowed.map((status) => status.toLowerCase()).join(", ")
        }.`,
      );
    }
  }
}
