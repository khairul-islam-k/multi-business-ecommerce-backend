import { and, count, eq, gte, isNull, lte, SQL, sql } from "drizzle-orm";

import {
  business,
  BusinessStatus,
  customer,
  customerWishlist,
  financeAccount,
  financeAccountTransaction,
  financeExpense,
  FinanceExpenseStatus,
  financePayable,
  FinancePayableStatus,
  financeReceivable,
  FinanceReceivableStatus,
  inventoryStock,
  inventoryStockMovement,
  inventoryWarehouseStock,
  order,
  orderReturn,
  packagePayment,
  PackagePaymentStatus,
  packageSubscription,
  PackageSubscriptionStatus,
  product,
  productVariant,
  systemUser,
  SystemUserStatus,
  SystemUserType,
  warehouse,
} from "@/database/schema";
import { Injectable } from "@nestjs/common";

import { apiResponse } from "../../common/utils/api-response.util";
import { DatabaseService } from "../../database/database.service";
import { OverviewQueryDto } from "./dto/dashboard.dto";

import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

type DateRange = {
  from: Date;
  to: Date;
};

type OverviewCard = {
  key: string;
  label: string;
  value: number | string;
  format: "number" | "currency" | "decimal";
  currencyCode?: string;
};

type OverviewChart = {
  key: string;
  label: string;
  type: "line" | "bar" | "donut";
  data: Record<string, number | string>[];
};

type OverviewPayload = {
  range: {
    from: string;
    to: string;
  };
  cards: OverviewCard[];
  charts: OverviewChart[];
};

@Injectable()
export class DashboardService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  async tenantGeneralOverview(businessId: string, query: OverviewQueryDto) {
    const range = this.getRange(query);
    const [
      orderTotals,
      customerTotals,
      productTotals,
      stockTotals,
      orderSeries,
      revenueSeries,
      statusBreakdown,
    ] = await Promise.all([
      this.orderTotals(businessId, range),
      this.customerTotals(businessId),
      this.productTotals(businessId),
      this.stockTotals(businessId),
      this.ordersOverTime(businessId, range),
      this.revenueOverTime(businessId, range),
      this.orderStatusBreakdown(businessId, range),
    ]);

    return apiResponse({
      range: this.rangeResponse(range),
      cards: [
        this.card("orders", "Orders", orderTotals.totalOrders),
        this.moneyCard("revenue", "Revenue", orderTotals.totalRevenue),
        this.card("customers", "Customers", customerTotals.totalCustomers),
        this.card("products", "Products", productTotals.totalProducts),
        this.card("variants", "Variants", productTotals.totalVariants),
        this.card(
          "lowStockItems",
          "Low stock items",
          stockTotals.lowStockItems,
        ),
      ],
      charts: [
        this.chart("ordersOverTime", "Orders over time", "line", orderSeries),
        this.chart(
          "revenueOverTime",
          "Revenue over time",
          "line",
          revenueSeries,
        ),
        this.chart(
          "orderStatusBreakdown",
          "Order status",
          "donut",
          statusBreakdown,
        ),
      ],
    } satisfies OverviewPayload);
  }

  async tenantOrdersOverview(businessId: string, query: OverviewQueryDto) {
    const range = this.getRange(query);
    const [
      totals,
      orderSeries,
      revenueSeries,
      statusBreakdown,
      paymentBreakdown,
    ] = await Promise.all([
      this.orderTotals(businessId, range),
      this.ordersOverTime(businessId, range),
      this.revenueOverTime(businessId, range),
      this.orderStatusBreakdown(businessId, range),
      this.orderPaymentStatusBreakdown(businessId, range),
    ]);

    return apiResponse({
      range: this.rangeResponse(range),
      cards: [
        this.card("orders", "Orders", totals.totalOrders),
        this.moneyCard("revenue", "Revenue", totals.totalRevenue),
        this.moneyCard(
          "averageOrderValue",
          "Average order",
          totals.averageOrderValue,
        ),
        this.card("pendingOrders", "Pending orders", totals.pendingOrders),
        this.card(
          "deliveredOrders",
          "Delivered orders",
          totals.deliveredOrders,
        ),
        this.card("returnedOrders", "Returned orders", totals.returnedOrders),
      ],
      charts: [
        this.chart("ordersOverTime", "Orders over time", "line", orderSeries),
        this.chart(
          "revenueOverTime",
          "Revenue over time",
          "line",
          revenueSeries,
        ),
        this.chart(
          "orderStatusBreakdown",
          "Order status",
          "donut",
          statusBreakdown,
        ),
        this.chart(
          "paymentStatusBreakdown",
          "Payment status",
          "donut",
          paymentBreakdown,
        ),
      ],
    } satisfies OverviewPayload);
  }

  async tenantFinanceOverview(businessId: string, query: OverviewQueryDto) {
    const range = this.getRange(query);
    const [
      accounts,
      expenses,
      receivables,
      payables,
      expenseSeries,
      transactionSeries,
      accountTypeBreakdown,
    ] = await Promise.all([
      this.accountTotals(businessId),
      this.expenseTotals(businessId, range),
      this.receivableTotals(businessId),
      this.payableTotals(businessId),
      this.expensesOverTime(businessId, range),
      this.cashflowOverTime(businessId, range),
      this.accountBalanceByType(businessId),
    ]);

    return apiResponse({
      range: this.rangeResponse(range),
      cards: [
        this.card("accounts", "Accounts", accounts.totalAccounts),
        this.moneyCard(
          "accountBalance",
          "Account balance",
          accounts.totalBalance,
        ),
        this.moneyCard("expenses", "Expenses", expenses.totalExpenses),
        this.moneyCard(
          "pendingReceivables",
          "Pending receivables",
          receivables.pendingAmount,
        ),
        this.moneyCard(
          "pendingPayables",
          "Pending payables",
          payables.pendingAmount,
        ),
      ],
      charts: [
        this.chart(
          "expensesOverTime",
          "Expenses over time",
          "bar",
          expenseSeries,
        ),
        this.chart(
          "cashflowOverTime",
          "Cashflow over time",
          "line",
          transactionSeries,
        ),
        this.chart(
          "accountBalanceByType",
          "Account balance by type",
          "donut",
          accountTypeBreakdown,
        ),
      ],
    } satisfies OverviewPayload);
  }

  async tenantInventoryOverview(businessId: string, query: OverviewQueryDto) {
    const range = this.getRange(query);
    const [
      productTotals,
      warehouseTotals,
      stockTotals,
      movementSeries,
      movementBreakdown,
      warehouseBreakdown,
    ] = await Promise.all([
      this.productTotals(businessId),
      this.warehouseTotals(businessId),
      this.stockTotals(businessId),
      this.stockMovementsOverTime(businessId, range),
      this.stockMovementBreakdown(businessId, range),
      this.stockByWarehouse(businessId),
    ]);

    return apiResponse({
      range: this.rangeResponse(range),
      cards: [
        this.card("products", "Products", productTotals.totalProducts),
        this.card("variants", "Variants", productTotals.totalVariants),
        this.card("warehouses", "Warehouses", warehouseTotals.totalWarehouses),
        this.decimalCard(
          "stockQuantity",
          "Stock quantity",
          stockTotals.totalQuantity,
        ),
        this.decimalCard(
          "reservedQuantity",
          "Reserved quantity",
          stockTotals.reservedQuantity,
        ),
        this.card(
          "lowStockItems",
          "Low stock items",
          stockTotals.lowStockItems,
        ),
      ],
      charts: [
        this.chart(
          "stockMovementsOverTime",
          "Stock movements over time",
          "bar",
          movementSeries,
        ),
        this.chart(
          "stockMovementBreakdown",
          "Movement types",
          "donut",
          movementBreakdown,
        ),
        this.chart(
          "stockByWarehouse",
          "Stock by warehouse",
          "bar",
          warehouseBreakdown,
        ),
      ],
    } satisfies OverviewPayload);
  }

  async adminOverview(query: OverviewQueryDto) {
    const range = this.getRange(query);
    const [
      tenants,
      businesses,
      orders,
      subscriptions,
      packagePayments,
      tenantSeries,
      businessSeries,
      orderSeries,
      revenueSeries,
    ] = await Promise.all([
      this.adminTenantTotals(),
      this.adminBusinessTotals(),
      this.adminOrderTotals(range),
      this.adminSubscriptionTotals(),
      this.adminPackagePaymentTotals(range),
      this.tenantsOverTime(range),
      this.businessesOverTime(range),
      this.adminOrdersOverTime(range),
      this.adminRevenueOverTime(range),
    ]);

    return apiResponse({
      range: this.rangeResponse(range),
      cards: [
        this.card("tenants", "Tenants", tenants.totalTenants),
        this.card("activeTenants", "Active tenants", tenants.activeTenants),
        this.card("businesses", "Businesses", businesses.totalBusinesses),
        this.card(
          "activeBusinesses",
          "Active businesses",
          businesses.activeBusinesses,
        ),
        this.card("orders", "Orders", orders.totalOrders),
        this.moneyCard(
          "platformOrderRevenue",
          "Order revenue",
          orders.totalRevenue,
        ),
        this.card(
          "activeSubscriptions",
          "Active subscriptions",
          subscriptions.activeSubscriptions,
        ),
        this.moneyCard(
          "packageRevenue",
          "Package revenue",
          packagePayments.totalRevenue,
        ),
      ],
      charts: [
        this.chart(
          "tenantsOverTime",
          "Tenants over time",
          "line",
          tenantSeries,
        ),
        this.chart(
          "businessesOverTime",
          "Businesses over time",
          "line",
          businessSeries,
        ),
        this.chart("ordersOverTime", "Orders over time", "line", orderSeries),
        this.chart(
          "revenueOverTime",
          "Revenue over time",
          "line",
          revenueSeries,
        ),
      ],
    } satisfies OverviewPayload);
  }

  async customerOverview(
    customerId: string,
    businessId: string,
    query: OverviewQueryDto,
  ) {
    const range = this.getRange(query);
    const [totals, orderSeries, spendingSeries, statusBreakdown] =
      await Promise.all([
        this.customerOrderTotals(customerId, businessId, range),
        this.customerOrdersOverTime(customerId, businessId, range),
        this.customerSpendingOverTime(customerId, businessId, range),
        this.customerOrderStatusBreakdown(customerId, businessId, range),
      ]);

    return apiResponse({
      range: this.rangeResponse(range),
      cards: [
        this.card("orders", "Orders", totals.totalOrders),
        this.moneyCard("totalSpent", "Total spent", totals.totalSpent),
        this.card("pendingOrders", "Pending orders", totals.pendingOrders),
        this.card("returns", "Returns", totals.totalReturns),
        this.card("wishlistItems", "Wishlist items", totals.wishlistItems),
      ],
      charts: [
        this.chart("ordersOverTime", "Orders over time", "line", orderSeries),
        this.chart(
          "spendingOverTime",
          "Spending over time",
          "line",
          spendingSeries,
        ),
        this.chart(
          "orderStatusBreakdown",
          "Order status",
          "donut",
          statusBreakdown,
        ),
      ],
    } satisfies OverviewPayload);
  }

  private async orderTotals(businessId: string, range: DateRange) {
    const [row] = await this.db
      .select({
        totalOrders: count(),
        totalRevenue: sql<string>`coalesce(sum(${order.totalAmount}), 0)`,
        averageOrderValue: sql<string>`coalesce(avg(${order.totalAmount}), 0)`,
        pendingOrders: sql<number>`count(*) filter (where ${order.status} in ('PLACED', 'CONFIRMED', 'PROCESSING'))`,
        deliveredOrders: sql<number>`count(*) filter (where ${order.status} = 'DELIVERED')`,
        returnedOrders: sql<number>`count(*) filter (where ${order.status} = 'RETURNED')`,
      })
      .from(order)
      .where(
        this.businessDateWhere(
          businessId,
          order.businessId,
          order.createdAt,
          range,
          order.deletedAt,
        ),
      );

    return {
      totalOrders: Number(row?.totalOrders ?? 0),
      totalRevenue: Number(row?.totalRevenue ?? 0),
      averageOrderValue: Number(row?.averageOrderValue ?? 0),
      pendingOrders: Number(row?.pendingOrders ?? 0),
      deliveredOrders: Number(row?.deliveredOrders ?? 0),
      returnedOrders: Number(row?.returnedOrders ?? 0),
    };
  }

  private async customerTotals(businessId: string) {
    const [row] = await this.db
      .select({ totalCustomers: count() })
      .from(customer)
      .where(
        and(eq(customer.businessId, businessId), isNull(customer.deletedAt)),
      );

    return { totalCustomers: Number(row?.totalCustomers ?? 0) };
  }

  private async productTotals(businessId: string) {
    const [products, variants] = await Promise.all([
      this.db
        .select({ totalProducts: count() })
        .from(product)
        .where(
          and(eq(product.businessId, businessId), isNull(product.deletedAt)),
        )
        .then(([row]) => Number(row?.totalProducts ?? 0)),
      this.db
        .select({ totalVariants: count() })
        .from(productVariant)
        .where(
          and(
            eq(productVariant.businessId, businessId),
            isNull(productVariant.deletedAt),
          ),
        )
        .then(([row]) => Number(row?.totalVariants ?? 0)),
    ]);

    return { totalProducts: products, totalVariants: variants };
  }

  private async warehouseTotals(businessId: string) {
    const [row] = await this.db
      .select({ totalWarehouses: count() })
      .from(warehouse)
      .where(
        and(eq(warehouse.businessId, businessId), isNull(warehouse.deletedAt)),
      );

    return { totalWarehouses: Number(row?.totalWarehouses ?? 0) };
  }

  private async stockTotals(businessId: string) {
    const [row] = await this.db
      .select({
        totalQuantity: sql<string>`coalesce(sum(${inventoryStock.totalQuantity}), 0)`,
        reservedQuantity: sql<string>`coalesce(sum(${inventoryStock.quantityReserved}), 0)`,
        lowStockItems: sql<number>`count(*) filter (where (${inventoryStock.totalQuantity} - ${inventoryStock.quantityReserved}) <= ${inventoryStock.lowStockAlertQty})`,
      })
      .from(inventoryStock)
      .where(eq(inventoryStock.businessId, businessId));

    return {
      totalQuantity: Number(row?.totalQuantity ?? 0),
      reservedQuantity: Number(row?.reservedQuantity ?? 0),
      lowStockItems: Number(row?.lowStockItems ?? 0),
    };
  }

  private async accountTotals(businessId: string) {
    const [row] = await this.db
      .select({
        totalAccounts: count(),
        totalBalance: sql<string>`coalesce(sum(${financeAccount.currentBalance}), 0)`,
      })
      .from(financeAccount)
      .where(
        and(
          eq(financeAccount.businessId, businessId),
          isNull(financeAccount.deletedAt),
        ),
      );

    return {
      totalAccounts: Number(row?.totalAccounts ?? 0),
      totalBalance: Number(row?.totalBalance ?? 0),
    };
  }

  private async expenseTotals(businessId: string, range: DateRange) {
    const [row] = await this.db
      .select({
        totalExpenses: sql<string>`coalesce(sum(${financeExpense.amount}), 0)`,
      })
      .from(financeExpense)
      .where(
        and(
          this.businessDateWhere(
            businessId,
            financeExpense.businessId,
            financeExpense.expenseDate,
            range,
          ),
          eq(financeExpense.status, FinanceExpenseStatus.PAID),
          isNull(financeExpense.deletedAt),
        ),
      );

    return { totalExpenses: Number(row?.totalExpenses ?? 0) };
  }

  private async receivableTotals(businessId: string) {
    const [row] = await this.db
      .select({
        pendingAmount: sql<string>`coalesce(sum(${financeReceivable.totalAmount} - ${financeReceivable.receivedAmount}), 0)`,
      })
      .from(financeReceivable)
      .where(
        and(
          eq(financeReceivable.businessId, businessId),
          sql`${financeReceivable.status} in (${FinanceReceivableStatus.PENDING}, ${FinanceReceivableStatus.PARTIALLY_RECEIVED})`,
        ),
      );

    return { pendingAmount: Number(row?.pendingAmount ?? 0) };
  }

  private async payableTotals(businessId: string) {
    const [row] = await this.db
      .select({
        pendingAmount: sql<string>`coalesce(sum(${financePayable.totalAmount} - ${financePayable.paidAmount}), 0)`,
      })
      .from(financePayable)
      .where(
        and(
          eq(financePayable.businessId, businessId),
          sql`${financePayable.status} in (${FinancePayableStatus.PENDING}, ${FinancePayableStatus.PARTIALLY_PAID})`,
        ),
      );

    return { pendingAmount: Number(row?.pendingAmount ?? 0) };
  }

  private async adminTenantTotals() {
    const [row] = await this.db
      .select({
        totalTenants: count(),
        activeTenants: sql<number>`count(*) filter (where ${systemUser.status} = ${SystemUserStatus.ACTIVE})`,
      })
      .from(systemUser)
      .where(
        and(
          eq(systemUser.type, SystemUserType.TENANT),
          isNull(systemUser.deletedAt),
        ),
      );

    return {
      totalTenants: Number(row?.totalTenants ?? 0),
      activeTenants: Number(row?.activeTenants ?? 0),
    };
  }

  private async adminBusinessTotals() {
    const [row] = await this.db
      .select({
        totalBusinesses: count(),
        activeBusinesses: sql<number>`count(*) filter (where ${business.status} = ${BusinessStatus.ACTIVE})`,
      })
      .from(business)
      .where(isNull(business.deletedAt));

    return {
      totalBusinesses: Number(row?.totalBusinesses ?? 0),
      activeBusinesses: Number(row?.activeBusinesses ?? 0),
    };
  }

  private async adminOrderTotals(range: DateRange) {
    const [row] = await this.db
      .select({
        totalOrders: count(),
        totalRevenue: sql<string>`coalesce(sum(${order.totalAmount}), 0)`,
      })
      .from(order)
      .where(this.dateWhere(order.createdAt, range, isNull(order.deletedAt)));

    return {
      totalOrders: Number(row?.totalOrders ?? 0),
      totalRevenue: Number(row?.totalRevenue ?? 0),
    };
  }

  private async adminSubscriptionTotals() {
    const [row] = await this.db
      .select({
        activeSubscriptions: sql<number>`count(*) filter (where ${packageSubscription.status} in (${PackageSubscriptionStatus.ACTIVE}, ${PackageSubscriptionStatus.TRIALING}))`,
      })
      .from(packageSubscription);

    return { activeSubscriptions: Number(row?.activeSubscriptions ?? 0) };
  }

  private async adminPackagePaymentTotals(range: DateRange) {
    const [row] = await this.db
      .select({
        totalRevenue: sql<string>`coalesce(sum(${packagePayment.amount}), 0)`,
      })
      .from(packagePayment)
      .where(
        and(
          this.dateWhere(packagePayment.confirmedAt, range),
          eq(packagePayment.status, PackagePaymentStatus.CONFIRMED),
        ),
      );

    return { totalRevenue: Number(row?.totalRevenue ?? 0) };
  }

  private async customerOrderTotals(
    customerId: string,
    businessId: string,
    range: DateRange,
  ) {
    const [orders, returns, wishlist] = await Promise.all([
      this.db
        .select({
          totalOrders: count(),
          totalSpent: sql<string>`coalesce(sum(${order.paidAmount}), 0)`,
          pendingOrders: sql<number>`count(*) filter (where ${order.status} in ('PLACED', 'CONFIRMED', 'PROCESSING'))`,
        })
        .from(order)
        .where(
          and(
            this.businessDateWhere(
              businessId,
              order.businessId,
              order.createdAt,
              range,
              order.deletedAt,
            ),
            eq(order.customerId, customerId),
          ),
        )
        .then(([row]) => ({
          totalOrders: Number(row?.totalOrders ?? 0),
          totalSpent: Number(row?.totalSpent ?? 0),
          pendingOrders: Number(row?.pendingOrders ?? 0),
        })),
      this.db
        .select({ totalReturns: count() })
        .from(orderReturn)
        .where(
          and(
            this.businessDateWhere(
              businessId,
              orderReturn.businessId,
              orderReturn.createdAt,
              range,
              orderReturn.deletedAt,
            ),
            sql`${orderReturn.orderId} in (select ${order.id} from ${order} where ${order.customerId} = ${customerId})`,
            isNull(orderReturn.deletedAt),
          ),
        )
        .then(([row]) => Number(row?.totalReturns ?? 0)),
      this.db
        .select({ wishlistItems: count() })
        .from(customerWishlist)
        .where(
          and(
            eq(customerWishlist.businessId, businessId),
            eq(customerWishlist.customerId, customerId),
          ),
        )
        .then(([row]) => Number(row?.wishlistItems ?? 0)),
    ]);

    return {
      ...orders,
      totalReturns: returns,
      wishlistItems: wishlist,
    };
  }

  private ordersOverTime(businessId: string, range: DateRange) {
    return this.dailySeries(
      "date",
      { orders: sql<number>`count(*)` },
      order,
      this.businessDateWhere(
        businessId,
        order.businessId,
        order.createdAt,
        range,
        order.deletedAt,
      ),
      order.createdAt,
    );
  }

  private revenueOverTime(businessId: string, range: DateRange) {
    return this.dailySeries(
      "date",
      { revenue: sql<string>`coalesce(sum(${order.totalAmount}), 0)` },
      order,
      this.businessDateWhere(
        businessId,
        order.businessId,
        order.createdAt,
        range,
        order.deletedAt,
      ),
      order.createdAt,
    );
  }

  private expensesOverTime(businessId: string, range: DateRange) {
    return this.dailySeries(
      "date",
      { expenses: sql<string>`coalesce(sum(${financeExpense.amount}), 0)` },
      financeExpense,
      and(
        this.businessDateWhere(
          businessId,
          financeExpense.businessId,
          financeExpense.expenseDate,
          range,
        ),
        eq(financeExpense.status, FinanceExpenseStatus.PAID),
        isNull(financeExpense.deletedAt),
      ),
      financeExpense.expenseDate,
    );
  }

  private cashflowOverTime(businessId: string, range: DateRange) {
    return this.dailySeries(
      "date",
      {
        credit: sql<string>`coalesce(sum(${financeAccountTransaction.amount}) filter (where ${financeAccountTransaction.transactionType} = 'CREDIT'), 0)`,
        debit: sql<string>`coalesce(sum(${financeAccountTransaction.amount}) filter (where ${financeAccountTransaction.transactionType} = 'DEBIT'), 0)`,
      },
      financeAccountTransaction,
      this.businessDateWhere(
        businessId,
        financeAccountTransaction.businessId,
        financeAccountTransaction.createdAt,
        range,
      ),
      financeAccountTransaction.createdAt,
    );
  }

  private stockMovementsOverTime(businessId: string, range: DateRange) {
    return this.dailySeries(
      "date",
      {
        quantity: sql<string>`coalesce(sum(${inventoryStockMovement.quantity}), 0)`,
      },
      inventoryStockMovement,
      this.businessDateWhere(
        businessId,
        inventoryStockMovement.businessId,
        inventoryStockMovement.createdAt,
        range,
      ),
      inventoryStockMovement.createdAt,
    );
  }

  private adminOrdersOverTime(range: DateRange) {
    return this.dailySeries(
      "date",
      { orders: sql<number>`count(*)` },
      order,
      this.dateWhere(order.createdAt, range, isNull(order.deletedAt)),
      order.createdAt,
    );
  }

  private adminRevenueOverTime(range: DateRange) {
    return this.dailySeries(
      "date",
      { revenue: sql<string>`coalesce(sum(${order.totalAmount}), 0)` },
      order,
      this.dateWhere(order.createdAt, range, isNull(order.deletedAt)),
      order.createdAt,
    );
  }

  private tenantsOverTime(range: DateRange) {
    return this.dailySeries(
      "date",
      { tenants: sql<number>`count(*)` },
      systemUser,
      and(
        this.dateWhere(
          systemUser.createdAt,
          range,
          isNull(systemUser.deletedAt),
        ),
        eq(systemUser.type, SystemUserType.TENANT),
      ),
      systemUser.createdAt,
    );
  }

  private businessesOverTime(range: DateRange) {
    return this.dailySeries(
      "date",
      { businesses: sql<number>`count(*)` },
      business,
      this.dateWhere(business.createdAt, range, isNull(business.deletedAt)),
      business.createdAt,
    );
  }

  private customerOrdersOverTime(
    customerId: string,
    businessId: string,
    range: DateRange,
  ) {
    return this.dailySeries(
      "date",
      { orders: sql<number>`count(*)` },
      order,
      and(
        this.businessDateWhere(
          businessId,
          order.businessId,
          order.createdAt,
          range,
          order.deletedAt,
        ),
        eq(order.customerId, customerId),
      ),
      order.createdAt,
    );
  }

  private customerSpendingOverTime(
    customerId: string,
    businessId: string,
    range: DateRange,
  ) {
    return this.dailySeries(
      "date",
      { spending: sql<string>`coalesce(sum(${order.paidAmount}), 0)` },
      order,
      and(
        this.businessDateWhere(
          businessId,
          order.businessId,
          order.createdAt,
          range,
          order.deletedAt,
        ),
        eq(order.customerId, customerId),
      ),
      order.createdAt,
    );
  }

  private orderStatusBreakdown(businessId: string, range: DateRange) {
    return this.breakdown(
      "status",
      order.status,
      { orders: count() },
      order,
      this.businessDateWhere(
        businessId,
        order.businessId,
        order.createdAt,
        range,
        order.deletedAt,
      ),
    );
  }

  private orderPaymentStatusBreakdown(businessId: string, range: DateRange) {
    return this.breakdown(
      "status",
      order.paymentStatus,
      { orders: count() },
      order,
      this.businessDateWhere(
        businessId,
        order.businessId,
        order.createdAt,
        range,
        order.deletedAt,
      ),
    );
  }

  private accountBalanceByType(businessId: string) {
    return this.breakdown(
      "type",
      financeAccount.accountType,
      {
        balance: sql<string>`coalesce(sum(${financeAccount.currentBalance}), 0)`,
      },
      financeAccount,
      and(
        eq(financeAccount.businessId, businessId),
        isNull(financeAccount.deletedAt),
      ),
    );
  }

  private stockMovementBreakdown(businessId: string, range: DateRange) {
    return this.breakdown(
      "type",
      inventoryStockMovement.movementType,
      {
        quantity: sql<string>`coalesce(sum(${inventoryStockMovement.quantity}), 0)`,
      },
      inventoryStockMovement,
      this.businessDateWhere(
        businessId,
        inventoryStockMovement.businessId,
        inventoryStockMovement.createdAt,
        range,
      ),
    );
  }

  private stockByWarehouse(businessId: string) {
    return this.db
      .select({
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        quantity: sql<string>`coalesce(sum(${inventoryWarehouseStock.totalQuantity}), 0)`,
        reserved: sql<string>`coalesce(sum(${inventoryWarehouseStock.quantityReserved}), 0)`,
      })
      .from(inventoryWarehouseStock)
      .innerJoin(
        warehouse,
        eq(warehouse.id, inventoryWarehouseStock.warehouseId),
      )
      .where(eq(inventoryWarehouseStock.businessId, businessId))
      .groupBy(warehouse.id, warehouse.name);
  }

  private customerOrderStatusBreakdown(
    customerId: string,
    businessId: string,
    range: DateRange,
  ) {
    return this.breakdown(
      "status",
      order.status,
      { orders: count() },
      order,
      and(
        this.businessDateWhere(
          businessId,
          order.businessId,
          order.createdAt,
          range,
          order.deletedAt,
        ),
        eq(order.customerId, customerId),
      ),
    );
  }

  private dailySeries(
    labelKey: string,
    fields: Record<string, SQL>,
    table: PgTable,
    where: SQL | undefined,
    dateColumn: PgColumn,
  ) {
    const day = sql<string>`to_char(date_trunc('day', ${dateColumn}), 'YYYY-MM-DD')`;

    return this.db
      .select({ [labelKey]: day, ...fields })
      .from(table)
      .where(where)
      .groupBy(day)
      .orderBy(day);
  }

  private breakdown(
    labelKey: string,
    labelColumn: PgColumn,
    fields: Record<string, SQL>,
    table: PgTable,
    where: SQL | undefined,
  ) {
    return this.db
      .select({ [labelKey]: labelColumn, ...fields })
      .from(table)
      .where(where)
      .groupBy(labelColumn);
  }

  private businessDateWhere(
    businessId: string,
    businessColumn: PgColumn,
    column: PgColumn,
    range: DateRange,
    deletedColumn?: PgColumn,
  ) {
    return and(
      eq(businessColumn, businessId),
      this.dateWhere(
        column,
        range,
        deletedColumn ? isNull(deletedColumn) : undefined,
      ),
    );
  }

  private dateWhere(column: PgColumn, range: DateRange, extra?: SQL) {
    return and(gte(column, range.from), lte(column, range.to), extra);
  }

  private getRange(query: OverviewQueryDto): DateRange {
    const to = query.to ? new Date(query.to) : new Date();
    const from =
      query.from !== undefined
        ? new Date(query.from)
        : new Date(to.getTime() - (query.days ?? 30) * 24 * 60 * 60 * 1000);

    return { from, to };
  }

  private rangeResponse(range: DateRange) {
    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    };
  }

  private card(key: string, label: string, value: number): OverviewCard {
    return { key, label, value, format: "number" };
  }

  private moneyCard(key: string, label: string, value: number): OverviewCard {
    return { key, label, value, format: "currency", currencyCode: "BDT" };
  }

  private decimalCard(key: string, label: string, value: number): OverviewCard {
    return { key, label, value, format: "decimal" };
  }

  private chart(
    key: string,
    label: string,
    type: OverviewChart["type"],
    data: Record<string, unknown>[],
  ): OverviewChart {
    return { key, label, type, data: data.map((row) => this.chartRow(row)) };
  }

  private chartRow(row: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, this.chartValue(value)]),
    ) as Record<string, number | string>;
  }

  private chartValue(value: unknown) {
    if (typeof value === "number" || typeof value === "string") {
      return value;
    }

    if (value === null || value === undefined) {
      return "";
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === "boolean" || typeof value === "bigint") {
      return value.toString();
    }

    return JSON.stringify(value);
  }
}
