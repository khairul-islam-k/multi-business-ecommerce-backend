# OneComm Codebase Explanation

This document is a re-entry guide for the OneComm backend. It explains what the product is, how the codebase is organized, how requests move through the application, how the database model is shaped, and how the main business flows connect.

## 1. Product Overview

OneComm is a private multi-tenant commerce backend built with NestJS, TypeScript, Prisma, and PostgreSQL. The product is designed for tenants who run one or more businesses. A tenant subscribes to a package, creates businesses, invites employees, assigns roles and permissions, uploads media, builds a product catalog, receives inventory from suppliers, and sells through admin/online orders or POS.

The backend is not just a simple catalog or order API. It models the wider operating loop:

- tenant registration and package subscription
- business creation and business selection
- employees, roles, and permission checks
- media uploads
- catalog setup
- inventory and warehouse stock
- supplier purchasing
- admin/online orders
- POS sales
- invoices
- tax, order payments, supplier payments, receivables, payables, expenses, and finance account transactions
- courier shipment and COD receivables
- future/partially modeled systems such as payment gateways, notifications, SMS marketing, and website builder data

Most active API modules are business-scoped. In practice, that means the URL usually contains `:businessId`, and the backend checks that the authenticated user can access that business before allowing the action.

## 2. Runtime And Tooling

The project currently uses:

- NestJS 11
- TypeScript
- Prisma 7
- PostgreSQL through `@prisma/adapter-pg`
- Passport JWT
- Argon2 password hashing
- Nodemailer for mail
- Swagger/OpenAPI
- Bun-oriented scripts in `package.json`

The app starts from `src/main.ts`. It:

- creates the Nest app from `AppModule`
- enables CORS for all origins
- sets the global API prefix to `api/v1`
- serves uploaded files from `MEDIA_UPLOAD_ROOT` under `PUBLIC_UPLOAD_PREFIX`
- installs a global `ValidationPipe` with whitelist, non-whitelisted rejection, and transform enabled
- creates Swagger docs at `/api/v1/docs`
- listens on `APP_IP` and `APP_PORT`

Important local environment variables are shown in `.env.example`, including database URL, JWT secrets, media limits, mail config, and OTP settings.

## 3. Project Structure

High-level structure:

```text
.
├── prisma/
│   ├── schema.prisma
│   └── models/
├── scripts/
├── src/
│   ├── common/
│   ├── modules/
│   ├── prisma/
│   ├── app.module.ts
│   └── main.ts
├── package.json
└── README.md
```

The important application folders are:

- `src/main.ts`: app bootstrap, global prefix, validation, Swagger, static uploads
- `src/app.module.ts`: root Nest module; imports all active modules
- `src/prisma/prisma.service.ts`: Prisma client wrapper and database connection lifecycle
- `src/common`: global request context, response helpers, exception filter, request logger
- `src/modules`: domain modules such as auth, business, packages, catalog, inventory, suppliers, orders, and POS
- `prisma/models`: Prisma schema split by business domain
- `scripts`: database/admin helper scripts

The Prisma schema is split. `prisma/schema.prisma` only defines the generator and datasource. The actual models live in `prisma/models/*.prisma`, with `prisma.config.ts` pointing Prisma at the whole `prisma` folder.

## 4. Active Application Modules

`AppModule` currently imports these major modules:

- `CommonModule`
- `PrismaModule`
- `AuthModule`
- `TenantModule`
- `PackageModule`
- `MediaModule`
- `BusinessModule`
- `RoleModule`
- `PermissionModule`
- `EmployeeModule`
- `ProductCatalogModule`
- `InventoryModule`
- `SupplierModule`
- `OrderModule`
- `PosModule`
- `FinanceModule`

The database schema contains additional domains, including invoices, courier, payment gateways, notifications, SMS, and website builder. Finance is now an active module: it exposes finance accounts, taxes, expenses, and receivables, and other modules call the shared ledger service to keep money state synchronized. Invoices and courier records are still created from business flows rather than through standalone invoice/courier controllers.

## 5. Cross-Cutting Request Flow

A typical protected request moves through these layers:

1. HTTP request hits a route under `/api/v1`.
2. `RequestContextMiddleware` creates an AsyncLocalStorage request context.
3. `RequestLoggerMiddleware` measures and logs the request after the response finishes.
4. Nest guards run, usually in this order on protected business routes:
   - `JwtAuthGuard`
   - `SubscriptionGuard`
   - `BusinessGuard`
   - `PermissionGuard`
   - sometimes `PackageLimitGuard`
5. DTO validation runs through the global `ValidationPipe`.
6. The controller delegates to a service.
7. The service reads/writes through `PrismaService`.
8. The service returns `apiResponse(...)` or `paginatedResponse(...)`.
9. If an error happens, `AllExceptionsFilter` normalizes it into a consistent JSON error response.

Successful non-paginated responses generally look like:

```json
{
  "data": {},
  "message": "Optional message"
}
```

Paginated responses look like:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 0,
    "totalPages": 0
  }
}
```

Error responses include `success: false`, `statusCode`, `message`, optional `errors`, `path`, optional `requestId`, and `timestamp`.

## 6. Authentication And Session Flow

Authentication lives in `src/modules/auth`.

Important database models:

- `SystemUser`
- `SystemUserProfile`
- `SystemEmailVerification`
- `SystemPasswordReset`
- `SystemSession`

There are three user types:

- `ADMIN`
- `TENANT`
- `EMPLOYEE`

Registration flow:

1. `POST /api/v1/auth/register`
2. Email is normalized.
3. Password is hashed with Argon2.
4. A tenant `SystemUser` is created as `INACTIVE`.
5. An email verification OTP row is created.
6. The default trial package is assigned through `PackageSubscriptionService.assignDefaultTrial`.
7. A first business is created through `BusinessService.create`.
8. Verification email is sent asynchronously.

Email verification:

1. User submits OTP.
2. The latest unexpired verification row is checked.
3. Failed attempts increment `attemptCount`.
4. On success, the verification row gets `verifiedAt`, and the user becomes `ACTIVE`.

Login flow:

1. `POST /api/v1/auth/login`
2. Email/password are checked.
3. Email must be verified.
4. User status must be `ACTIVE`.
5. Admin users receive tokens with no selected business.
6. Tenant/employee users get accessible businesses.
7. The first accessible business is selected by default.
8. Access and refresh tokens are issued.
9. A `SystemSession` row stores the hashed refresh token and selected business.

Refresh token flow:

- Refresh tokens are stored as SHA-256 hashes in `SystemSession`.
- Refresh rotates tokens: the old session is revoked and a new session is created.
- If a revoked token is reused, all user sessions are revoked.
- Refresh also revalidates active user status and subscription status.

Business selection:

- `POST /api/v1/auth/select-business`
- Confirms the user can access the requested business.
- Issues a new access token with that `businessId`.
- Updates the current refresh session to bind it to the chosen business.

JWT validation:

- `JwtStrategy` loads the user by `payload.sub`.
- User must exist and be `ACTIVE`.
- Token user type must match the database user type.
- Admin tokens always get `businessId: null`.
- Non-admin tokens must contain a selected `businessId`.

## 7. Tenant, Business, And Business Context

Tenants are represented by `SystemUser` rows with `type = TENANT`.

Businesses are represented by `Business`. Each business has:

- an owner tenant user
- a slug unique per owner
- optional contact fields
- currency and timezone
- status
- one `BusinessSetting`
- one `BusinessBranding`
- members, roles, media, catalog data, and audit logs

`BusinessService.create` creates the business plus default settings and branding. The default status is usually `TRIAL`.

Business access is enforced by `BusinessGuard`:

- If the route has a `:businessId` param, it validates that param and checks access.
- If there is no business param and the user is admin, business context can be `null`.
- If there is no param and the user is non-admin, the guard uses the `businessId` from the JWT.
- Access allows admins, owners, and active business members.
- The result is cached per request through `RequestContextService`.

The request context matters because `PermissionGuard` can reuse the business access result instead of doing duplicate access lookups.

## 8. Packages, Subscriptions, And Limits

Package data lives in:

- `PackagePlan`
- `PackagePlanFeature`
- `PackagePlanLimit`
- `PackageSubscription`
- `PackageUsageCounter`
- `PackageMockPayment`

Package limits use `PackageLimitKey`, such as:

- `MAX_BUSINESSES`
- `MAX_EMPLOYEES`
- `MAX_ROLES`
- `MAX_MEDIAS`
- `MAX_CATEGORIES`
- `MAX_BRANDS`
- `MAX_UNITS`
- `MAX_TAGS`
- `MAX_PRODUCTS`
- `MAX_VARIANTS`
- `MAX_ATTRIBUTES`

Subscription behavior:

- Tenant users get a default trial during registration.
- Active-like statuses are `TRIALING`, `ACTIVE`, and `PAST_DUE`.
- `SubscriptionGuard` blocks non-admin users whose tenant subscription is missing or expired.
- Admin users bypass subscription enforcement.
- If a current subscription is past `currentPeriodEnd`, it is marked `EXPIRED`.

Plan snapshots:

- When a subscription is created, the plan's features and limits are captured into `planSnapshot`.
- Limit checks read from the subscription snapshot, not just the live package plan.
- This preserves what the tenant actually bought at that point in time.

Limit checks:

- `PackageLimitGuard` reads metadata from `@RequirePackageLimit(...)`.
- It resolves the amount from a static amount, body field, or uploaded files count.
- `PackageLimitService.assertWithinLimit` compares requested creation amount against allowed usage.
- Usage is the max of live database usage and package usage counter usage.

The live usage strategy means limits are calculated from real records such as active businesses, employees, roles, media images, products, variants, categories, brands, units, tags, and attributes.

## 9. RBAC: Roles And Permissions

RBAC lives in:

- `RbacRole`
- `RbacRolePermission`
- `RbacUserRoleMap`

The enum `RbacFeature` defines permission areas:

- media management
- package management
- product catalog management
- supplier management
- inventory management
- order management
- POS management
- payment management
- finance management
- courier management
- business management
- employee management
- role/permission management

The enum `PermissionAction` defines:

- `CREATE`
- `READ`
- `UPDATE`
- `DELETE`

Permission behavior:

- Admins are allowed.
- Business owners are allowed.
- Employees and other members need an active `RbacUserRoleMap`.
- The assigned role must be active, business-scoped, not deleted, and contain the required feature/action.
- Role assignments can expire.

Controllers declare permission requirements using `@RequirePermission(feature, action)`. `PermissionGuard` reads that metadata and calls `PermissionService.assertPermission`.

## 10. Employees

Employee management uses `SystemUser` with `type = EMPLOYEE`.

Creating an employee:

1. Email and phone are checked for uniqueness.
2. Role IDs are validated against the business.
3. Password is hashed.
4. A `SystemUser` is created with `tenantId` set to the tenant owner.
5. A `SystemUserProfile` is created.
6. A `BusinessMember` is created for the target business.
7. Optional `RbacUserRoleMap` records are created.

Removing an employee:

- The business membership is marked inactive and soft-deleted.
- Active role assignments in the business are revoked.
- If the employee has no remaining active memberships, the user and profile are soft-deleted/inactivated.

This makes employee accounts reusable across multiple business memberships in principle, while still allowing removal from one business.

## 11. Media

Media currently focuses on image uploads.

Important models:

- `MediaAsset`
- `MediaTag`
- `MediaAssetTag`

Upload behavior:

1. Route receives one or many files through Multer.
2. MIME type must be one of GIF, JPEG, PNG, or WebP.
3. File must have a non-empty buffer.
4. Package media limit is checked.
5. `LocalMediaUploader` writes the file under:

```text
uploads/media/<businessId>/<uuid>.<ext>
```

6. A public URL is built from `PUBLIC_UPLOAD_PREFIX`.
7. A `MediaAsset` row is created.
8. Tags are normalized to lowercase comma-separated values and connected or created.

Deletion behavior:

- Media rows are soft-deleted by setting `status = INACTIVE` and `deletedAt`.
- The local file is removed if its URL is under the configured public upload prefix.
- Path traversal protection is handled by checking the resolved path stays inside the upload root.

## 12. Product Catalog

Catalog data is business-scoped.

Important models:

- `ProductCategory`
- `ProductBrand`
- `ProductUnit`
- `ProductTag`
- `Product`
- `ProductVariant`
- `ProductAttribute`
- `ProductAttributeValue`
- `ProductVariantAttribute`
- `ProductImage`
- `ProductTagMap`

Catalog structure:

- Categories can be nested with `parentId`.
- Products can optionally reference category, brand, and unit.
- Products have many variants.
- Variants are the sellable/inventory-tracked units.
- Product attributes and values describe variant dimensions.
- Variant attributes map a variant to selected attribute values.
- Product images can be attached to products and optionally variants.
- Tags connect to products through `ProductTagMap`.

Variant creation is especially important:

1. Product existence is checked.
2. Attribute/value pairs are validated.
3. A unique SKU is generated.
4. A unique barcode is generated.
5. The variant is created.
6. An aggregate `InventoryStock` row is created with zero quantity.

So inventory begins at variant creation even before any warehouse has physical stock.

Variant deletion is conservative:

- The variant cannot be deleted if referenced by inventory, orders, invoices, supplier records, courier shipment items, adjustments, transfers, or allocations.
- If allowed, the variant is soft-deleted and its zero aggregate stock row is deleted.

## 13. Inventory And Warehouses

Inventory is variant-based and split into two levels.

Aggregate stock:

- `InventoryStock`
- one row per `businessId + variantId`
- stores total quantity and reserved quantity across the business

Warehouse stock:

- `InventoryWarehouseStock`
- one row per `businessId + warehouseId + variantId`
- stores physical quantity and reserved quantity in a warehouse

Movement/audit records:

- `InventoryStockMovement`
- records purchase in, sale out, transfer, adjustment, reserved, and reservation release events

Order allocations:

- `InventoryOrderAllocation`
- links an order item to the selected stock and warehouse
- status is `RESERVED`, `FULFILLED`, or `RELEASED`

Core helper:

- `InventoryLookupService` owns the low-level stock mutation logic.

`applyStockDelta`:

- Used for stock increases/decreases such as purchase receiving and adjustments.
- Upserts aggregate stock.
- Upserts warehouse stock.
- Prevents negative total stock.
- Prevents reducing below available stock when reserved stock exists.
- Creates an `InventoryStockMovement`.

`reserveForOrder`:

- Requires a positive quantity.
- Finds the aggregate stock row.
- Chooses a warehouse.
- Creates an `InventoryOrderAllocation`.
- Increments aggregate reserved quantity.
- Increments warehouse reserved quantity.
- Creates a `RESERVED` stock movement.

Warehouse selection:

- If `warehouseId` is supplied, that warehouse must exist and have enough available stock.
- If no `warehouseId` is supplied, the service chooses a warehouse with enough available stock.
- Auto-pick sorts by highest available quantity.
- Ties choose the oldest warehouse.
- One order item is allocated from one warehouse; it is not split across multiple warehouses.

`releaseOrderReservation`:

- Requires an existing reserved allocation.
- Decrements aggregate and warehouse reserved quantity.
- Marks the allocation `RELEASED`.
- Creates a `RESERVATION_RELEASED` movement.

`fulfillOrderAllocation`:

- Requires an existing reserved allocation.
- Decrements aggregate total quantity and reserved quantity.
- Decrements warehouse total quantity and reserved quantity.
- Marks the allocation `FULFILLED`.
- Creates a `SALE_OUT` movement.

## 14. Suppliers And Purchasing

Supplier data lives in:

- `Supplier`
- `SupplierProductMap`
- `SupplierPurchaseOrder`
- `SupplierPurchaseOrderItem`
- `SupplierInvoice`
- `SupplierInvoiceItem`
- `SupplierPayment`
- `SupplierPurchaseReturn`
- `SupplierPurchaseReturnItem`

The supplier service covers suppliers, supplier-product mapping, purchase orders, full purchase receiving, supplier invoices, supplier invoice payments, and supplier purchase returns.

Supplier product mapping:

- Connects a supplier to a product variant.
- Tracks supplier SKU, last purchase price, minimum order quantity, and lead time.
- Unique per `businessId + supplierId + variantId`.

Purchase order creation:

1. Supplier must exist and be active.
2. Warehouse must exist and be active.
3. Tax must exist, be active, and belong to the business.
4. Each item variant must exist.
5. Duplicate variants in one purchase order are rejected.
6. Backend calculates subtotal, discount, tax, shipping, and total.
7. Tax is calculated from the selected `taxId`; shipping is not taxed.
8. Backend generates a `PO-*` purchase order number.
9. Purchase order and items are created.

Purchase order receiving:

1. Purchase order must be `ORDERED`.
2. Partial receiving is not supported.
3. The receive action receives every ordered item in full.
4. For each item:
   - item `quantityReceived` is set to ordered quantity
   - inventory stock increases through `applyStockDelta`
   - movement type is `PURCHASE_IN`
   - reference type is `PURCHASE_ORDER`
   - supplier product map is upserted with last purchase price
5. A `SupplierInvoice` and `SupplierInvoiceItem` rows are created from the PO.
6. `FinanceLedgerService.createSupplierInvoicePayable` creates a finance payable for the supplier invoice.
7. Purchase order status becomes `RECEIVED`.

Supplier invoice payment:

1. Supplier invoice must exist and not be cancelled.
2. Payment amount is not supplied by the client.
3. Backend calculates the exact due amount.
4. A `SupplierPayment` row is created.
5. The selected finance account is debited.
6. The supplier invoice `paidAmount` and status are updated.
7. The related `FinancePayable` is updated to `PAID` or `PARTIALLY_PAID`.

Supplier purchase returns:

1. A return can only be created after the PO is received and its supplier invoice is paid.
2. Returns are new immutable requests; they do not edit the original PO or supplier invoice.
3. Return items must come from the original PO and cannot exceed the remaining returnable received quantity.
4. Return totals reuse the PO item cost, proportional discount, and PO tax rate.
5. Creating a return creates a `SupplierPurchaseReturn` in `PENDING` status.
6. Creating a return also creates a `FinanceReceivable` with `partyType = SUPPLIER` and `sourceType = SUPPLIER_RETURN`.
7. Completing the return moves stock out with movement type `PURCHASE_RETURN_OUT`.
8. Cancelling a pending return cancels the related pending supplier-return receivable.

Only draft purchase orders can be deleted. Received purchase orders cannot be edited; supplier returns are the adjustment path after receiving and paying.

## 15. Orders

Order data lives in:

- `OrderCustomer`
- `OrderCustomerAddress`
- `OrderCart`
- `OrderCartItem`
- `OrderOrder`
- `OrderOrderItem`
- `OrderStatusLog`
- `OrderDiscount`
- `OrderPayment`
- `OrderReturn`
- `OrderReturnItem`
- `OrderRefund`

The primary implemented service is `OrderService`.

Normal order creation:

1. Called through `POST /api/v1/orders/businesses/:businessId/orders`.
2. Items are required.
3. Duplicate variants in a single order are rejected.
4. `taxId` is required and must point to an active business tax row.
5. Payment/COD input is validated.
6. Optional customer is checked.
7. COD orders must include courier shipment data.
8. Backend generates:
   - `ORD-*` order number
   - `INV-*` invoice number
9. Product variant prices are loaded from active variants.
10. Item line totals and order totals are calculated by the backend.
11. Tax is calculated from the selected `taxId`; shipping is not taxed.
12. A transaction creates:
   - `OrderOrder`
   - status log
   - order items
   - inventory reservations for every item
   - invoice and invoice items
   - optional direct payment
   - optional courier shipment
13. Payment state is recalculated.

Normal orders are created as `CONFIRMED` rather than merely pending. Inventory is reserved immediately, not deducted immediately.

Payments:

- COD is not recorded as a direct order payment.
- COD orders cannot include direct payment.
- Direct payment requires `financeAccountId`.
- Client does not send payment amount.
- During order creation, direct payment pays the full order total.
- During later payment, backend pays the exact remaining due amount.
- `OrderPayment` is created with status `PAID`.
- `FinanceLedgerService.creditAccount` creates a `FinanceAccountTransaction` as `CREDIT`.
- `FinanceAccount.currentBalance` is incremented.
- Order `paidAmount` and `paymentStatus` are recalculated.
- Related invoice `paidAmount` and status are updated to `ISSUED`, `PARTIALLY_PAID`, or `PAID`.
- Non-COD unpaid/partially paid orders create or update a `FinanceReceivable`.
- Fully paid orders mark their order receivable as `RECEIVED`.

The old client-driven underpayment/overpayment path has been removed. If a normal order has no payment at creation, it becomes a receivable. If payment is later added, the backend collects the exact due amount.

Shipping:

- Valid from `CONFIRMED` or `PROCESSING`.
- Updates order to `SHIPPED`.
- Creates status log.
- Pending courier shipments for the order become `BOOKED` and get `shippedAt`.

Delivery:

- Valid from `CONFIRMED`, `PROCESSING`, or `SHIPPED`.
- Every reserved allocation is fulfilled, which deducts inventory.
- Order becomes `DELIVERED`.
- Status log is created.
- Courier shipment becomes `DELIVERED`.
- If courier shipment has COD amount and a courier, a `CourierReceivable` is created for expected settlement.

Cancellation:

- Cannot cancel delivered or already cancelled orders.
- Reserved allocations are released.
- Order becomes `CANCELLED`.
- Related invoice rows become `CANCELLED`.
- Related courier shipments become `CANCELLED`.
- Status log is created.

## 16. POS

POS is implemented as a fast path over `OrderService`.

Route:

```text
POST /api/v1/pos/businesses/:businessId/sales
```

POS behavior:

1. COD is rejected.
2. `taxId` is required.
3. Payment is required.
4. Payment amount is not supplied by the client.
5. Backend calculates the full total and records payment for that exact amount.
6. Order type is forced to `POS`.
7. Order source is forced to `POS`.
8. `fulfillImmediately` is true.
9. The order is created as `DELIVERED`.
10. Inventory is reserved and immediately fulfilled for each item.
11. Finance account is credited.
12. Invoice is created and then refreshed to paid state.

This means POS sales share the same order, payment, finance, invoice, and inventory foundations as normal orders, but skip the later shipping/delivery lifecycle.

## 17. Invoices

Invoice models:

- `Invoice`
- `InvoiceItem`
- `InvoiceTemplate`

There is no standalone invoice controller in the current module list, but invoices are actively created by `OrderService`.

Invoice creation mirrors order creation:

- one invoice per order creation flow
- invoice number generated as `INV-*`
- invoice items mirror order items
- `taxId`, `taxRate`, and calculated `taxTotal` mirror the order
- customer fields and address snapshots copy from the order
- status starts as `ISSUED`
- payment refresh updates invoice `paidAmount` and status
- cancellation sets invoice status to `CANCELLED`

## 18. Finance

Finance models:

- `FinanceTax`
- `FinanceAccount`
- `FinanceAccountTransaction`
- `FinanceExpenseCategory`
- `FinanceExpense`
- `FinanceReceivable`
- `FinancePayable`
- `FinanceJournalEntry`
- `FinanceJournalEntryLine`

Finance is an active Nest module imported by `AppModule`. It exposes controllers for accounts, taxes, expense categories, expenses, and receivables. It also exports `FinanceLedgerService`, which other modules use to move account balances and synchronize receivable/payable state.

Finance account behavior:

- Accounts are business-scoped.
- Opening balance is recorded by crediting the account through the ledger.
- Opening balance cannot be edited afterward.
- Account transactions are created by ledger debit/credit operations.
- A finance account cannot be deleted while it has a positive balance.

Tax behavior:

- `FinanceTax` is business-scoped.
- Orders and purchase orders require a tax row.
- Use a 0% tax row when an order or PO should have no tax.
- Tax is applied to item subtotal minus discount.
- Shipping is excluded from tax.
- `taxRate` is copied onto orders, invoices, purchase orders, supplier invoices, and supplier returns so history is preserved even if the tax row changes later.

Expense behavior:

- Expense categories are business-scoped.
- Expenses start as `DRAFT`.
- Draft expenses can be updated or cancelled.
- Paying an expense debits the selected finance account and marks the expense `PAID`.
- Paid expenses cannot be edited or cancelled.

Receivable behavior:

- Order flows create/update order receivables for unpaid or partially paid non-COD orders.
- Supplier purchase returns create supplier receivables.
- The finance receivable API can list and receive receivables.
- Direct receiving is blocked for order receivables and courier receivables because those have module-specific flows.
- Supplier return receivables can be received through finance; the backend credits the selected account for the exact remaining amount.

Payable behavior:

- Receiving a purchase order creates a supplier invoice payable.
- Paying a supplier invoice debits the selected finance account.
- Supplier invoice payment synchronizes the related `FinancePayable` status.

Journal entry models exist in the schema, but there is not yet a standalone journal-entry controller.

## 19. Courier And COD

Courier models:

- `Courier`
- `CourierConfig`
- `CourierDeliveryZone`
- `CourierDeliveryZoneArea`
- `CourierShippingCharge`
- `CourierShipment`
- `CourierShipmentItem`
- `CourierReceivable`
- `CourierSettlement`
- `CourierSettlementItem`

There is no standalone courier controller imported right now, but `OrderService` creates and updates courier records.

Courier shipment creation:

- optional during order creation
- backend generates `SHP-*`
- shipment items mirror order items
- if `isCod` is true, COD amount is calculated as order total minus paid amount

Courier lifecycle through order actions:

- shipping an order turns pending shipment into booked
- delivering an order turns shipment into delivered
- cancelling an order cancels shipment

COD handling:

- COD is deliberately not treated as immediate business cash.
- Direct COD order payments are rejected.
- When a delivered shipment has COD amount, `CourierReceivable` is created.
- Later settlement models exist to represent courier settlement and net receivable after courier fee.

## 20. Payment Gateway, Notifications, SMS, And Website Builder

These domains are modeled in Prisma but are not imported as active Nest modules in `AppModule` yet.

Payment gateway schema supports:

- global gateways
- business gateway configs
- payment methods
- webhook events

Notification schema supports:

- notification templates
- in-app/email/SMS/push channels
- system-user or customer recipients
- order/payment/inventory/subscription/system/marketing/custom notification types

SMS schema supports:

- providers
- provider configs
- SMS templates
- campaigns
- campaign recipients
- SMS logs

Website builder schema supports:

- templates
- websites
- domains
- pages
- page sections
- components
- theme settings
- SEO settings
- publish versions

These are future or partially staged product areas. They are important because other modules may eventually depend on them, but there are no current controllers/services for these domains in the imported app module list.

## 21. Route Surface Summary

All routes are under `/api/v1`.

Main route groups:

- `auth/*`
- `tenants/*`
- `tenant/packages/*`
- `admin/packages/*`
- `businesses/*`
- `employees/businesses/:businessId/*`
- `roles/businesses/:businessId/*`
- `permissions/*`
- `media/businesses/:businessId/*`
- `product-catalog/businesses/:businessId/categories`
- `product-catalog/businesses/:businessId/brands`
- `product-catalog/businesses/:businessId/units`
- `product-catalog/businesses/:businessId/tags`
- `product-catalog/businesses/:businessId/products`
- `product-catalog/businesses/:businessId/products/:productId/attributes`
- `product-catalog/businesses/:businessId/products/:productId/variants`
- `inventory/businesses/:businessId/warehouses`
- `inventory/businesses/:businessId/stocks`
- `inventory/businesses/:businessId/stock-adjustments`
- `inventory/businesses/:businessId/stock-transfers`
- `suppliers/businesses/:businessId`
- `suppliers/businesses/:businessId/supplier-invoices`
- `suppliers/businesses/:businessId/purchase-orders`
- `suppliers/businesses/:businessId/purchase-returns`
- `finance/businesses/:businessId/accounts`
- `finance/businesses/:businessId/taxes`
- `finance/businesses/:businessId/expense-categories`
- `finance/businesses/:businessId/expenses`
- `finance/businesses/:businessId/receivables`
- `orders/businesses/:businessId/orders`
- `pos/businesses/:businessId/sales`

Swagger is available at:

```text
http://<APP_IP>:<APP_PORT>/api/v1/docs
```

With the example env defaults, that is:

```text
http://localhost:8080/api/v1/docs
```

## 22. End-To-End Data Flow: Tenant Setup To Sale

A realistic setup flow:

1. Tenant registers.
2. System creates inactive tenant user, OTP, default trial subscription, and first business.
3. Tenant verifies email.
4. Tenant logs in and receives JWT plus refresh token.
5. Tenant creates or updates business settings and branding.
6. Tenant creates employees.
7. Tenant creates roles and permissions.
8. Tenant assigns roles to employees.
9. Tenant uploads media.
10. Tenant creates catalog categories, brands, units, tags, products, attributes, values, and variants.
11. Variant creation creates aggregate zero stock.
12. Tenant creates warehouses.
13. Tenant creates suppliers.
14. Tenant creates finance taxes, including a 0% tax if needed.
15. Tenant creates finance accounts for cash, bank, mobile banking, payment gateways, or other money stores.
16. Tenant creates purchase orders with a tax row.
17. Tenant receives purchase orders in full.
18. Inventory aggregate and warehouse stock increase.
19. Supplier invoice and finance payable are created.
20. Tenant pays supplier invoice from a finance account.
21. Tenant creates order or POS sale.

Normal order path:

```text
Order created
  -> order items created
  -> inventory reserved per item
  -> invoice created
  -> optional direct payment credits finance for exact total
  -> unpaid/partial non-COD order syncs finance receivable
  -> optional courier shipment created
  -> ship updates order/shipment state
  -> deliver fulfills allocation and deducts stock
  -> COD delivery creates courier receivable when applicable
```

POS path:

```text
POS sale
  -> order created as POS/DELIVERED
  -> order items created
  -> inventory reserved
  -> inventory fulfilled immediately
  -> exact full payment created
  -> finance account credited
  -> invoice created/refreshed to paid
```

Supplier purchasing path:

```text
Purchase order created with tax
  -> purchase order is marked ORDERED
  -> receive action receives the full PO
  -> inventory increases
  -> supplier invoice created
  -> finance payable created
  -> supplier invoice paid for exact due amount
  -> finance account debited
  -> finance payable marked paid
```

Supplier return path:

```text
Paid received PO selected
  -> supplier purchase return request created
  -> finance receivable created against supplier
  -> return completed
  -> inventory moves out
  -> supplier refund received through finance receivable
  -> finance account credited
```

## 23. Data Ownership And Scoping Rules

The most important data ownership rules are:

- `SystemUser` is global.
- Tenant users own package subscriptions.
- Employee users point back to the tenant through `tenantId`.
- `Business` belongs to an owner user.
- Most operational records include `businessId`.
- Business members connect users to businesses.
- RBAC roles are business-scoped.
- Catalog, inventory, media, supplier, order, invoice, finance, courier, SMS, and website rows are generally business-scoped.
- Admin users bypass many tenant/business restrictions.
- Business owners bypass RBAC permission checks for their business.
- Employees need explicit role permissions.

This scoping design is central to the whole app. When adding new modules, the safest default is to include `businessId`, validate business access, require a subscription, and protect actions with `@RequirePermission`.

## 24. Transaction Boundaries

The code uses Prisma transactions for flows that must stay consistent:

- registration creates user, OTP, subscription, and business together
- variant creation creates variant and stock together
- stock reservation/release/fulfillment updates multiple stock tables plus movement/allocation rows
- purchase order receiving updates purchase items, stock, movements, supplier product map, and purchase order status
- purchase order receiving also creates supplier invoice and finance payable
- supplier invoice payment creates supplier payment, debits finance account, and updates payable state
- supplier return creation creates return items and supplier receivable
- supplier return completion moves stock out
- order creation creates order, items, allocations, invoice, optional payment, optional courier shipment, and payment/receivable state
- order delivery/cancellation updates order, allocations, invoice/courier/receivable state, and logs
- expense payment debits finance account and marks the expense paid
- receivable receiving credits finance account and marks the receivable received
- employee creation/removal touches users, memberships, profiles, and role maps
- role permission replacement deletes and recreates permissions atomically

The pattern is: whenever a business event affects multiple tables, the service usually wraps it in `this.prisma.$transaction`.

## 25. Soft Deletes And Statuses

The codebase uses a mix of statuses and soft deletes.

Common pattern:

- set a status such as `INACTIVE`, `CANCELLED`, or `ARCHIVED`
- set `deletedAt`
- keep historical rows for references and auditability

Examples:

- businesses are marked inactive and soft-deleted
- employees can be soft-deleted if they have no active memberships
- roles are inactive/soft-deleted only if not assigned
- media assets are inactive/soft-deleted and local files are deleted
- suppliers cannot be deleted if referenced by purchase records
- variants cannot be deleted if referenced by operational records

Deletion is intentionally conservative around commerce data because orders, stock movements, invoices, supplier records, and courier records need historical integrity.

## 26. Code Style And Patterns

Recurring implementation patterns:

- Controllers are thin and delegate to services.
- Services own business rules.
- DTOs use class-validator/class-transformer.
- Responses are wrapped with `apiResponse` or `paginatedResponse`.
- Business-scoped routes usually include `businesses/:businessId`.
- Package-limited create routes use `@RequirePackageLimit(...)`.
- Permission-protected routes use `@RequirePermission(...)`.
- IDs are UUIDs.
- Generated operational codes use prefixes such as `ORD`, `INV`, `PAY`, `TXN`, `SHP`, `PO`, `RET`, `SIN`, `SPAY`, `REC`, `PAYB`, `EXP`, `ADJ`, `TRF`, `SKU`, and `BAR`.
- Prisma unique errors are often converted into domain-specific `BadRequestException` or `ConflictException`.
- Many list endpoints support pagination, sorting, filtering, and search.

## 27. Important Implementation Notes

Some useful details to keep in mind when returning to the code:

- `prisma/schema.prisma` is intentionally tiny; real model definitions are under `prisma/models`.
- `prisma.config.ts` supplies the Prisma schema directory and database URL.
- The app uses Bun in the scripts, even though the README still references `pnpm` in places.
- `src/main.ts` serves uploaded files from the configured upload root.
- `PrismaService` logs query operation/table/duration in debug logs, while skipping transaction begin/commit/rollback logs.
- `SubscriptionGuard` currently returns true if there is no user or the user is admin. In normal protected routes, `JwtAuthGuard` runs before it, so no-user cases should already be blocked.
- `FinanceModule` is active and exposes accounts, taxes, expenses, and receivables.
- `OrderService` writes invoice, finance, and courier records as part of order flow.
- `SupplierService` writes supplier invoice, payable, supplier payment, supplier return, and supplier-return receivable records as part of purchasing flow.
- Purchase orders are not partially receivable. Receiving is all-or-nothing for the whole PO.
- Supplier returns are the post-receive/post-pay adjustment path and create new receivables instead of editing the PO.
- Order/POS payment amount is backend-controlled. Clients choose payment method/account, not amount.
- Orders and purchase orders require `taxId`; use an active 0% tax row for no-tax cases.
- On an existing database, the required tax relation needs a migration/backfill plan: create a 0% tax per business, backfill old orders/POs, then enforce the required `taxId`.
- COD is represented as courier receivable/settlement, not as immediate order payment.
- POS is not a separate data model. It is an order flow with `orderType = POS`, `orderSource = POS`, and immediate fulfillment.

## 28. Mental Model For Future Work

When adding or debugging a feature, think in this order:

1. Who is acting?
   - admin, tenant owner, or employee
2. What business is selected?
   - from URL param or JWT
3. Is the tenant subscription active?
4. Does the action require a package limit?
5. Does the user have the needed RBAC permission?
6. Which business-scoped rows are affected?
7. Does the operation touch stock, money, invoice, or shipment state?
8. If yes, should it run in a transaction?
9. Does it need a movement/log/history row?
10. Should deletion be soft and guarded by reference checks?

That mental model matches how the current codebase is structured and will keep new changes aligned with the existing design.
