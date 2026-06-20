# OneComm API

OneComm is a NestJS and Drizzle backend for a multi-tenant commerce platform. A tenant can subscribe to a package, create businesses, manage staff and permissions, build a catalog, upload media, track stock, buy from suppliers, sell by order or POS, and keep finance records.

## Module Map

| Module               | What it does                                                                                                                                  | User story                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Auth                 | Registration, login, JWT refresh, sessions, email verification, password reset, and business selection.                                       | As a tenant or employee, I sign in and work inside the right business context. |
| Packages             | Plans, subscriptions, package changes, credits, and limits for businesses, employees, media, and products.                                    | As a tenant, I use a plan that controls how much my account can create.        |
| Businesses           | Business profile, settings, branding, owner access, and active business membership.                                                           | As a merchant, I create and configure each business I operate.                 |
| Employees and RBAC   | Employees, roles, permissions, assignments, and guarded business routes.                                                                      | As an owner, I invite staff and control what each person can do.               |
| Media                | Image upload, tagging, listing, and deletion with local public asset serving.                                                                 | As a catalog manager, I upload product and brand images.                       |
| Product Catalog      | Categories, brands, units, tags, attributes, products, variants, product images, SKUs, and barcodes.                                          | As a merchant, I create products customers or cashiers can browse and sell.    |
| Inventory            | Warehouses, aggregate stock, warehouse stock, movements, adjustments, transfers, reservations, and fulfillment.                               | As an inventory user, I know what stock exists and where it is.                |
| Suppliers            | Suppliers, supplier products, purchase orders, receiving, returns, invoices, and supplier payables.                                           | As a buyer, I purchase stock and receive it into a warehouse.                  |
| Customers and Orders | Customers, addresses, orders, order items, payments, invoices, status changes, and optional courier shipment records.                         | As a sales user, I create and manage customer orders.                          |
| POS                  | Fast sale flow that creates an order, reserves and fulfills stock, records payment, and issues an invoice.                                    | As a cashier, I complete an in-store sale quickly.                             |
| Finance              | Accounts, account transactions, taxes, expenses, receivables, payables, and ledger helpers.                                                   | As an operator, I track money received, owed, and spent.                       |
| Tenants and Admin    | Admin tenant views and status management.                                                                                                     | As an admin, I monitor and manage tenant accounts.                             |
| Websites             | Website records, predefined template selection, JSON config for header/footer/navigation/sections, domains, theme, SEO, and publish versions. | As a merchant, I configure and publish a storefront for a business.            |
| Storefront           | Public browse-only website resolver, categories, active product listing, product detail, stock summary, and approved reviews.                 | As a customer, I browse a published storefront before checkout exists.         |
| Reviews              | Product and variant reviews with ratings and moderation status.                                                                               | As a merchant, I collect and approve customer feedback for storefront display. |

## Current Storefront Status

Browse-only storefront support now has a backend foundation: tenants can create/configure/publish websites, map domains, and expose published catalog data through public storefront endpoints. Checkout is intentionally still outside the storefront scope.

## Tech

- NestJS, TypeScript, Drizzle ORM, PostgreSQL
- Passport JWT, Nodemailer, Swagger
- Bun, Jest, ESLint, Prettier

## Run Locally

```bash
bun install
cp .env.example .env
bun run db:push
bun run db:seed-admin
bun run dev
```

Swagger is available after startup at:

```text
http://localhost:8080/api/v1/docs
```

## Useful Scripts

```bash
bun run typecheck
bun run test
bun run build
bun run db:generate
bun run db:push
bun run db:studio
```

## Notes

This project is private and unlicensed. Keep the Drizzle schema and database in sync before testing cross-module flows.
