# OneComm API

OneComm is a private NestJS backend for running a multi-tenant commerce operation. It is designed around the full business loop: tenants subscribe to a package, create businesses, invite employees, configure roles and permissions, manage media and catalog data, buy stock from suppliers into warehouses, and sell through online/admin orders or POS.

## Tech Stack

- NestJS
- TypeScript
- Prisma
- PostgreSQL
- Passport JWT
- Nodemailer
- Swagger / OpenAPI
- Jest, ESLint, Prettier

## Business Story

A tenant signs up and receives a package subscription. The package controls how much the tenant can create, such as businesses, employees, roles, media, products, variants, categories, brands, units, tags, and attributes.

The tenant creates a business, adds employees, assigns roles, uploads media, builds a product catalog, buys stock from suppliers, places that stock in warehouses, and sells items through either normal orders or POS sales. The system keeps catalog, inventory, payments, finance, courier, invoice, and subscription concerns connected through explicit records instead of hidden side effects.

The intended operating flow is:

1. Tenant subscribes to a package.
2. Tenant creates one or more businesses within package limits.
3. Business owner invites employees.
4. Roles define which employees can manage catalog, media, inventory, suppliers, orders, finance, courier, and packages.
5. Product catalog is created with categories, brands, units, tags, products, attributes, and variants.
6. Each variant gets backend-generated `SKU-*` and `BAR-*` codes.
7. Each variant automatically gets one aggregate stock row with zero quantity.
8. Supplier purchase orders receive stock into warehouses.
9. Orders reserve stock from one warehouse per item.
10. POS sales reserve and fulfill stock immediately.
11. Payments update order payment state and finance accounts.
12. Invoices are generated for orders.
13. Courier shipments can be created for delivery orders.
14. COD money is recognized after courier settlement.

## Core Modules

### Auth, Tenants, And Businesses

Users authenticate with JWT. Tenant users own package subscriptions and businesses. A business is the working context for catalog, employees, roles, media, inventory, suppliers, orders, finance, and courier records.

Business access is enforced by `BusinessGuard`. Subscription access is enforced by `SubscriptionGuard`.

### Packages And Limits

Packages define plan limits through `PackageLimitKey`, such as:

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

Create endpoints that consume limited resources should use `PackageLimitGuard` and `@RequirePackageLimit(...)`. Usage is calculated from live data and package usage counters.

### Employees, Roles, And Permissions

Employees are business users. Roles are business-scoped permission groups. RBAC controls feature access with `RbacFeature` and `PermissionAction`.

Examples:

- product catalog managers can create products and variants.
- inventory users can adjust or transfer stock.
- supplier users can create purchase orders.
- finance users can record or reconcile money.
- POS users can sell quickly from the counter.

### Media Management

Media stores business images. Product images and other visual assets reference uploaded media URLs. Media upload is package-limited so businesses cannot exceed their plan allowance.

### Product Catalog

Catalog data is business-scoped:

- categories
- brands
- units
- tags
- products
- attributes and attribute values
- variants
- product images

Products describe what is sold. Variants are the sellable units. Inventory is variant-based.

When a variant is created:

- backend generates `SKU-*`
- backend generates `BAR-*`
- inventory creates one aggregate `InventoryStock` row with `0` quantity

If a buying price changes enough to require separate cost tracking, the recommended workflow is to create a new product or variant rather than batch-costing old stock.

### Inventory And Warehouses

Inventory is split into two levels:

- `InventoryStock`: one aggregate stock row per business and variant.
- `InventoryWarehouseStock`: the same stock physically distributed across warehouses.

Example:

```text
Variant A
  InventoryStock: total 15, reserved 2
  Warehouse 1: total 10, reserved 1
  Warehouse 2: total 5, reserved 1
```

Stock increases and decreases always update both aggregate stock and warehouse stock.

Warehouse selection for order allocation:

- if the request supplies `warehouseId`, inventory uses that warehouse.
- if no `warehouseId` is supplied, inventory auto-picks one warehouse.
- auto-pick uses the warehouse with the highest available quantity.
- if there is a tie, the oldest warehouse wins.
- one order item is allocated from one warehouse, not split across many warehouses.

Inventory records stock movements for auditability:

- purchase in
- sale out
- sale return in
- purchase return out
- adjustment in/out
- transfer in/out
- reserved
- reservation released

### Suppliers And Purchasing

Suppliers provide product variants. Purchase orders are backend-numbered with `PO-*`.

Supplier purchasing flow:

1. Create supplier.
2. Create purchase order for a warehouse.
3. Add variant items and quantities.
4. Mark purchase order as ordered.
5. Receive the purchase order.
6. Inventory increases aggregate and warehouse stock.
7. Supplier product mapping records last purchase price.

Supplier purchase receiving does not create batches. Stock is kept simple: aggregate per variant and distributed by warehouse.

### Orders

Normal orders represent online/admin sales.

Recommended flow:

1. Backend generates `ORD-*`.
2. Order is created with variant items.
3. Invoice is generated with `INV-*`.
4. Inventory reserves stock immediately.
5. Payment state starts as unpaid, partially paid, or paid depending on payment input.
6. Optional courier shipment can be created on order create.
7. Cancel releases reservation.
8. Ship moves operational order status.
9. Deliver fulfills inventory allocations and deducts stock.

Normal orders reserve stock before delivery so the same items cannot be oversold.

### POS

POS is a fast sale path over the same order, inventory, payment, invoice, and finance foundations.

POS flow:

1. Cashier creates sale.
2. Backend creates order with `orderType = POS` and `orderSource = POS`.
3. Backend generates `ORD-*`.
4. Inventory reserves stock.
5. Inventory immediately fulfills allocation and deducts stock.
6. Payment is recorded immediately.
7. Finance account is credited.
8. Invoice is generated.
9. Order becomes delivered.

POS should normally require a finance account for the payment target, such as cash drawer, bank, mobile banking, or card/gateway clearing account.

### Payments And Finance

Order payments record customer money against orders. Finance records where that money lands.

Recommended behavior:

- non-COD payments require a `financeAccountId`.
- payment creates an `OrderPayment`.
- order `paidAmount` and `paymentStatus` are recalculated.
- finance account balance is updated.
- a `FinanceAccountTransaction` is created.

Finance also supports:

- accounts
- account transactions
- expense categories
- expenses
- receivables
- payables
- journal entries

Courier fees, gateway fees, refunds, and manual expenses should be recorded through finance so account balances stay explainable.

### Invoices

Every order should generate an invoice automatically. Invoice items mirror order items. Invoice status follows order/payment state:

- issued when order is confirmed.
- partially paid when some money is received.
- paid when fully paid.
- cancelled when order is cancelled.

### Courier And COD

Courier shipment is optional on order create and can also be created later.

Courier flow:

1. Order is created and stock is reserved.
2. Courier shipment is optionally created with `SHP-*`.
3. Shipment items mirror order items.
4. Shipment can be booked, picked up, in transit, delivered, failed, returned, or cancelled.
5. For COD, customer pays courier, not the business directly.
6. On courier delivery, a courier receivable tracks expected settlement.
7. On settlement, finance receives net money and records courier fee as an expense.

COD payment should not be treated as business cash until courier settlement.

## End-To-End Example

```text
Tenant subscribes to package
  -> creates business
  -> invites employees
  -> assigns roles and permissions
  -> uploads product media
  -> creates catalog and variants
  -> receives supplier purchase into warehouse
  -> creates online order
  -> inventory reserves warehouse stock
  -> invoice is issued
  -> optional courier shipment is created
  -> customer pays or chooses COD
  -> delivery fulfills reservation and deducts stock
  -> payment/settlement updates finance
```

For POS:

```text
Cashier scans SKU/barcode
  -> POS creates delivered order
  -> inventory deducts immediately
  -> payment credits finance account
  -> invoice is issued
```

## Requirements

- Node.js
- pnpm
- PostgreSQL

## Installation

```bash
pnpm install
```

## Environment Setup

Create your local environment file from the example file:

```bash
cp .env.example .env
```

Then update `.env` for your database, JWT settings, mail credentials, media storage, and other local configuration.

## Database Commands

Generate Prisma client:

```bash
pnpm run db:generate
```

Push schema changes to the database:

```bash
pnpm run db:push
```

Seed the admin user:

```bash
pnpm run db:seed-admin
```

Open Prisma Studio:

```bash
pnpm run db:studio
```

Reset database data:

```bash
pnpm run db:reset-data
```

## Running The App

Development mode:

```bash
pnpm run dev
```

Standard NestJS watch mode:

```bash
pnpm run start:dev
```

Production build:

```bash
pnpm run build
```

Start production server:

```bash
pnpm run start:prod
```

## Available Scripts

| Script                   | Description                                                       |
| ------------------------ | ----------------------------------------------------------------- |
| `pnpm run dev`           | Generate Prisma client and start app in watch mode                |
| `pnpm run build`         | Generate Prisma client, push DB schema, seed admin, and build app |
| `pnpm run start`         | Start the app                                                     |
| `pnpm run start:dev`     | Start app in watch mode                                           |
| `pnpm run start:debug`   | Start app in debug watch mode                                     |
| `pnpm run start:prod`    | Run compiled production app                                       |
| `pnpm run db:migrate`    | Run Prisma migrations                                             |
| `pnpm run db:push`       | Push Prisma schema to database                                    |
| `pnpm run db:generate`   | Generate Prisma client                                            |
| `pnpm run db:seed-admin` | Seed default admin user                                           |
| `pnpm run db:reset-data` | Reset database data                                               |
| `pnpm run db:studio`     | Open Prisma Studio                                                |
| `pnpm run format`        | Format code with Prettier                                         |
| `pnpm run lint`          | Lint and auto-fix TypeScript files                                |

## API Documentation

Swagger documentation is available after the app starts, usually at:

```text
http://localhost:8080/v1/api/docs
```

The exact path depends on the Swagger setup in `src/main.ts`.

## Project Structure

```text
onecomm-api/
├── prisma/
├── scripts/
├── src/
│   ├── common/
│   ├── modules/
│   └── prisma/
├── package.json
└── README.md
```

## Notes

- This project is private.
- The license is `UNLICENSED`.
- Review seed scripts before running them in production.
- Keep Prisma schema and the live database synchronized before testing new module flows.
