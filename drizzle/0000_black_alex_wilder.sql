CREATE TYPE "public"."BusinessBrandingDensity" AS ENUM('COMPACT', 'DEFAULT', 'COMFORTABLE');--> statement-breakpoint
CREATE TYPE "public"."BusinessMemberStatus" AS ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."BusinessStatus" AS ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."CatalogProductStatus" AS ENUM('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."CommonStatus" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."CourierConfigMode" AS ENUM('SANDBOX', 'LIVE');--> statement-breakpoint
CREATE TYPE "public"."CourierConfigStatus" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."CourierDeliveryZoneStatus" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."CourierProvider" AS ENUM('PATHAO', 'REDX', 'STEADFAST');--> statement-breakpoint
CREATE TYPE "public"."CourierReceivableStatus" AS ENUM('PENDING', 'PARTIALLY_SETTLED', 'SETTLED', 'DISPUTED');--> statement-breakpoint
CREATE TYPE "public"."CourierSettlementStatus" AS ENUM('DRAFT', 'CONFIRMED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."CourierShipmentStatus" AS ENUM('PENDING', 'BOOKED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'RETURNED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."CourierShippingChargeStatus" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."CourierStatus" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."CustomerAddressType" AS ENUM('HOME', 'OFFICE', 'SHIPPING', 'BILLING', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."CustomerOtpPurpose" AS ENUM('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'EMAIL_CHANGE');--> statement-breakpoint
CREATE TYPE "public"."CustomerStatus" AS ENUM('ACTIVE', 'INACTIVE', 'BLOCKED');--> statement-breakpoint
CREATE TYPE "public"."FinanceAccountStatus" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."FinanceAccountType" AS ENUM('CASH', 'BANK', 'MOBILE_BANKING', 'PAYMENT_GATEWAY', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."FinanceExpenseCategoryStatus" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."FinanceExpenseStatus" AS ENUM('DRAFT', 'PAID', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."FinanceJournalLineType" AS ENUM('DEBIT', 'CREDIT');--> statement-breakpoint
CREATE TYPE "public"."FinancePartyType" AS ENUM('CUSTOMER', 'SUPPLIER', 'COURIER', 'PAYMENT_GATEWAY', 'EMPLOYEE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."FinancePayableStatus" AS ENUM('PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."FinanceReceivableStatus" AS ENUM('PENDING', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."FinanceSourceType" AS ENUM('ORDER', 'SUPPLIER_INVOICE', 'SUPPLIER_PAYMENT', 'SUPPLIER_RETURN', 'COURIER_RECEIVABLE', 'COURIER_SETTLEMENT', 'EXPENSE', 'REFUND', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."FinanceTaxStatus" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."FinanceTransactionType" AS ENUM('DEBIT', 'CREDIT');--> statement-breakpoint
CREATE TYPE "public"."Gender" AS ENUM('MALE', 'FEMALE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."InventoryAdjustmentStatus" AS ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."InventoryAdjustmentType" AS ENUM('INCREASE', 'DECREASE');--> statement-breakpoint
CREATE TYPE "public"."InventoryMovementType" AS ENUM('PURCHASE_IN', 'PURCHASE_RETURN_OUT', 'SALE_OUT', 'SALE_RETURN_IN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'RESERVED', 'RESERVATION_RELEASED');--> statement-breakpoint
CREATE TYPE "public"."InventoryOrderAllocationStatus" AS ENUM('RESERVED', 'FULFILLED', 'RELEASED');--> statement-breakpoint
CREATE TYPE "public"."InventoryReferenceType" AS ENUM('PURCHASE_ORDER', 'SUPPLIER_INVOICE', 'PURCHASE_RETURN', 'ORDER', 'ORDER_RETURN', 'STOCK_ADJUSTMENT', 'STOCK_TRANSFER', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."InventoryTransferStatus" AS ENUM('DRAFT', 'PENDING', 'APPROVED', 'SHIPPED', 'RECEIVED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."InvoiceStatus" AS ENUM('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."InvoiceTemplateStatus" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."MediaAssetStatus" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."MediaFileType" AS ENUM('IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."MediaTagStatus" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."OrderCartStatus" AS ENUM('ACTIVE', 'ORDERED');--> statement-breakpoint
CREATE TYPE "public"."OrderDiscountSource" AS ENUM('MANUAL', 'COUPON', 'PROMOTION');--> statement-breakpoint
CREATE TYPE "public"."OrderDiscountType" AS ENUM('FIXED', 'PERCENTAGE');--> statement-breakpoint
CREATE TYPE "public"."OrderPaymentMethod" AS ENUM('CASH', 'COD', 'ONLINE_PAYMENT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."OrderPaymentStatus" AS ENUM('PENDING', 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."OrderRefundMethod" AS ENUM('COD', 'ONLINE_PAYMENT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."OrderRefundStatus" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."OrderReturnStatus" AS ENUM('REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."OrderSource" AS ENUM('WEBSITE', 'POS', 'ADMIN_PANEL');--> statement-breakpoint
CREATE TYPE "public"."OrderStatus" AS ENUM('PLACED', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED');--> statement-breakpoint
CREATE TYPE "public"."OrderType" AS ENUM('ONLINE', 'POS', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."OtpPurpose" AS ENUM('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'EMAIL_CHANGE');--> statement-breakpoint
CREATE TYPE "public"."PackageBillingCycle" AS ENUM('FREE', 'MONTHLY', 'YEARLY', 'LIFETIME');--> statement-breakpoint
CREATE TYPE "public"."PackageCreditEntryType" AS ENUM('DOWNGRADE_CREDIT', 'CREDIT_APPLIED', 'ADMIN_ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "public"."PackageLimitKey" AS ENUM('MAX_MEDIAS', 'MAX_PRODUCTS', 'MAX_EMPLOYEES', 'MAX_BUSINESSES');--> statement-breakpoint
CREATE TYPE "public"."PackagePaymentStatus" AS ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."PackagePaymentType" AS ENUM('PLAN_CHANGE', 'CREDIT_ONLY_PLAN_CHANGE');--> statement-breakpoint
CREATE TYPE "public"."PackageResetCycle" AS ENUM('LIFETIME', 'DAILY', 'MONTHLY', 'YEARLY');--> statement-breakpoint
CREATE TYPE "public"."PackageStatus" AS ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."PackageSubscriptionStatus" AS ENUM('TRIALING', 'ACTIVE', 'PAST_DUE', 'SUPERSEDED', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."PaymentGatewayConfigStatus" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."PaymentGatewayMode" AS ENUM('SANDBOX', 'LIVE');--> statement-breakpoint
CREATE TYPE "public"."PaymentGatewayProvider" AS ENUM('SSLCOMMERZ', 'AAMARPAY', 'SHURJOPAY');--> statement-breakpoint
CREATE TYPE "public"."PaymentGatewayStatus" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."PaymentWebhookStatus" AS ENUM('PENDING', 'PROCESSED', 'FAILED', 'IGNORED');--> statement-breakpoint
CREATE TYPE "public"."PermissionAction" AS ENUM('CREATE', 'READ', 'UPDATE', 'DELETE');--> statement-breakpoint
CREATE TYPE "public"."ProductReviewStatus" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."ProductSimpleStatus" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."ProductVariantStatus" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."RbacFeature" AS ENUM('MEDIA_MANAGEMENT', 'PACKAGE_MANAGEMENT', 'PRODUCT_MANAGEMENT', 'SUPPLIER_MANAGEMENT', 'INVENTORY_MANAGEMENT', 'ORDER_MANAGEMENT', 'POS_MANAGEMENT', 'PAYMENT_MANAGEMENT', 'FINANCE_MANAGEMENT', 'COURIER_MANAGEMENT', 'BUSINESS_MANAGEMENT', 'EMPLOYEE_MANAGEMENT', 'ROLE_PERMISSION_MANAGEMENT', 'WEBSITE_MANAGEMENT');--> statement-breakpoint
CREATE TYPE "public"."SupplierInvoiceStatus" AS ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."SupplierPaymentMethod" AS ENUM('CASH', 'BANK_TRANSFER', 'MOBILE_BANKING', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."SupplierProductMapStatus" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."SupplierPurchaseOrderStatus" AS ENUM('DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."SupplierPurchaseReturnStatus" AS ENUM('DRAFT', 'PENDING', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."SupplierStatus" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."SystemUserStatus" AS ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."SystemUserType" AS ENUM('ADMIN', 'TENANT', 'EMPLOYEE');--> statement-breakpoint
CREATE TYPE "public"."UserRoleMapStatus" AS ENUM('ACTIVE', 'INACTIVE', 'EXPIRED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."WarehouseStatus" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."WebsiteDomainSslStatus" AS ENUM('PENDING', 'ACTIVE', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."WebsiteDomainType" AS ENUM('SUBDOMAIN', 'CUSTOM_DOMAIN');--> statement-breakpoint
CREATE TYPE "public"."WebsiteDomainVerificationStatus" AS ENUM('PENDING', 'VERIFIED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."WebsiteStatus" AS ENUM('DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."WebsiteTemplate" AS ENUM('FASHION');--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"slug" varchar(180) NOT NULL,
	"email" varchar(255),
	"phone" varchar(30),
	"country" varchar(100),
	"currency_code" varchar(10),
	"timezone" varchar(100),
	"status" "BusinessStatus" NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp (6) with time zone
);
--> statement-breakpoint
CREATE TABLE "business_brandings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"logo_url" text,
	"favicon_url" text,
	"primary_color" varchar(20),
	"primary_hover_color" varchar(20),
	"primary_active_color" varchar(20),
	"secondary_color" varchar(20),
	"accent_color" varchar(20),
	"success_color" varchar(20),
	"warning_color" varchar(20),
	"error_color" varchar(20),
	"info_color" varchar(20),
	"dashboard_background_color" varchar(20),
	"sidebar_background_color" varchar(20),
	"sidebar_text_color" varchar(20),
	"sidebar_muted_text_color" varchar(20),
	"sidebar_active_background_color" varchar(20),
	"sidebar_active_text_color" varchar(20),
	"sidebar_hover_background_color" varchar(20),
	"header_background_color" varchar(20),
	"header_text_color" varchar(20),
	"card_background_color" varchar(20),
	"elevated_background_color" varchar(20),
	"table_header_background_color" varchar(20),
	"table_row_hover_color" varchar(20),
	"input_background_color" varchar(20),
	"disabled_background_color" varchar(20),
	"text_primary_color" varchar(20),
	"text_secondary_color" varchar(20),
	"text_muted_color" varchar(20),
	"text_inverse_color" varchar(20),
	"border_color" varchar(20),
	"border_subtle_color" varchar(20),
	"focus_ring_color" varchar(20),
	"font_family" varchar(100),
	"border_radius" varchar(30),
	"density" "BusinessBrandingDensity",
	"seo_title" varchar(255),
	"seo_description" text,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_brandings_business_id_unique" UNIQUE("business_id")
);
--> statement-breakpoint
CREATE TABLE "business_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "BusinessMemberStatus" NOT NULL,
	"joined_at" timestamp (6) with time zone,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"deleted_by" uuid,
	"deleted_at" timestamp (6) with time zone
);
--> statement-breakpoint
CREATE TABLE "business_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"order_prefix" varchar(20),
	"invoice_prefix" varchar(20),
	"payment_prefix" varchar(20),
	"shipment_prefix" varchar(20),
	"purchase_order_prefix" varchar(20),
	"purchase_return_prefix" varchar(20),
	"stock_adjustment_prefix" varchar(20),
	"stock_transfer_prefix" varchar(20),
	"expense_prefix" varchar(20),
	"supplier_invoice_prefix" varchar(20),
	"supplier_payment_prefix" varchar(20),
	"receivable_prefix" varchar(20),
	"payable_prefix" varchar(20),
	"transaction_prefix" varchar(20),
	"product_sku_prefix" varchar(20),
	"product_barcode_prefix" varchar(20),
	"variant_sku_prefix" varchar(20),
	"variant_barcode_prefix" varchar(20),
	"default_warehouse_id" uuid NOT NULL,
	"default_finance_account_id" uuid NOT NULL,
	"default_unit_id" uuid NOT NULL,
	"default_tax_id" uuid NOT NULL,
	"low_stock_threshold" integer,
	"auto_confirm_order" boolean,
	"cod_enabled" boolean,
	"online_payment_enabled" boolean,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_settings_business_id_unique" UNIQUE("business_id")
);
--> statement-breakpoint
CREATE TABLE "couriers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"code" "CourierProvider" NOT NULL,
	"description" text,
	"status" "CourierStatus" DEFAULT 'ACTIVE' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courier_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"courier_id" uuid NOT NULL,
	"config_data" jsonb NOT NULL,
	"mode" "CourierConfigMode" DEFAULT 'SANDBOX' NOT NULL,
	"status" "CourierConfigStatus" DEFAULT 'INACTIVE' NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "courier_delivery_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"status" "CourierDeliveryZoneStatus" DEFAULT 'ACTIVE' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "courier_delivery_zone_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_zone_id" uuid NOT NULL,
	"area_name" varchar(150) NOT NULL,
	"city" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courier_receivables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"courier_id" uuid NOT NULL,
	"shipment_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"cod_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"courier_fee" numeric(12, 2) DEFAULT 0 NOT NULL,
	"net_receivable" numeric(12, 2) DEFAULT 0 NOT NULL,
	"status" "CourierReceivableStatus" DEFAULT 'PENDING' NOT NULL,
	"expected_settlement_date" timestamp,
	"settled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "courier_receivables_shipment_id_unique" UNIQUE("shipment_id")
);
--> statement-breakpoint
CREATE TABLE "courier_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"courier_id" uuid NOT NULL,
	"settlement_no" varchar(100) NOT NULL,
	"settlement_date" timestamp NOT NULL,
	"total_cod_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"total_courier_fee" numeric(12, 2) DEFAULT 0 NOT NULL,
	"total_settlement_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"status" "CourierSettlementStatus" DEFAULT 'DRAFT' NOT NULL,
	"reference_no" varchar(150),
	"note" text,
	"created_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "courier_settlement_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"settlement_id" uuid NOT NULL,
	"receivable_id" uuid NOT NULL,
	"shipment_id" uuid NOT NULL,
	"cod_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"courier_fee" numeric(12, 2) DEFAULT 0 NOT NULL,
	"settlement_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courier_shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"courier_id" uuid,
	"courier_config_id" uuid,
	"delivery_zone_id" uuid,
	"shipment_no" varchar(100) NOT NULL,
	"consignment_id" varchar(150),
	"tracking_code" varchar(150),
	"status" "CourierShipmentStatus" DEFAULT 'PENDING' NOT NULL,
	"shipping_charge" numeric(12, 2) DEFAULT 0 NOT NULL,
	"cod_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"courier_fee" numeric(12, 2) DEFAULT 0 NOT NULL,
	"recipient_name" varchar(150),
	"recipient_phone" varchar(30),
	"delivery_address_snapshot" jsonb,
	"shipped_at" timestamp,
	"delivered_at" timestamp,
	"cancelled_at" timestamp,
	"created_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "courier_shipment_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"quantity" numeric(14, 3) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courier_shipping_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"delivery_zone_id" uuid NOT NULL,
	"courier_id" uuid,
	"min_weight" numeric(10, 3),
	"max_weight" numeric(10, 3),
	"shipping_charge" numeric(12, 2) DEFAULT 0 NOT NULL,
	"cod_charge" numeric(12, 2) DEFAULT 0 NOT NULL,
	"status" "CourierShippingChargeStatus" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"email" varchar(150),
	"imageUrl" varchar(255),
	"phone" varchar(30),
	"status" "CustomerStatus" NOT NULL,
	"note" text,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "customer_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"website_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"email_verified_at" timestamp (6) with time zone,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"deleted_by" uuid,
	"deleted_at" timestamp (6) with time zone
);
--> statement-breakpoint
CREATE TABLE "customer_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"address_type" "CustomerAddressType" NOT NULL,
	"name" varchar(150),
	"address" text NOT NULL,
	"city" varchar(100),
	"country" varchar(100),
	"is_default" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_by" uuid,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "customer_email_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"otp_hash" text NOT NULL,
	"purpose" "CustomerOtpPurpose" NOT NULL,
	"attempt_count" integer NOT NULL,
	"expires_at" timestamp (6) with time zone NOT NULL,
	"verified_at" timestamp (6) with time zone,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_password_resets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"otp_hash" text NOT NULL,
	"attempt_count" integer NOT NULL,
	"expires_at" timestamp (6) with time zone NOT NULL,
	"used_at" timestamp (6) with time zone,
	"verified_at" timestamp (6) with time zone,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"website_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"expires_at" timestamp (6) with time zone NOT NULL,
	"revoked_at" timestamp (6) with time zone,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_sessions_refresh_token_hash_unique" UNIQUE("refresh_token_hash")
);
--> statement-breakpoint
CREATE TABLE "customer_wishlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"account_type" "FinanceAccountType" NOT NULL,
	"account_number" varchar(100),
	"currency_code" varchar(10) NOT NULL,
	"opening_balance" numeric(12, 2) NOT NULL,
	"current_balance" numeric(12, 2) NOT NULL,
	"status" "FinanceAccountStatus" NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "finance_account_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"transaction_no" varchar(100) NOT NULL,
	"transaction_type" "FinanceTransactionType" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"balance_before" numeric(12, 2) NOT NULL,
	"balance_after" numeric(12, 2) NOT NULL,
	"reference_type" "FinanceSourceType",
	"reference_id" uuid,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"expense_category_id" uuid NOT NULL,
	"expense_no" varchar(100) NOT NULL,
	"title" varchar(200) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"expense_date" timestamp NOT NULL,
	"status" "FinanceExpenseStatus" NOT NULL,
	"reference_no" varchar(150),
	"note" text,
	"created_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "finance_expense_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"status" "FinanceExpenseCategoryStatus" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_by" uuid,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "finance_journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"journal_no" varchar(100) NOT NULL,
	"journal_date" timestamp NOT NULL,
	"reference_type" "FinanceSourceType",
	"reference_id" uuid,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_journal_entry_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"entry_type" "FinanceJournalLineType" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_payables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"payable_no" varchar(100) NOT NULL,
	"party_type" "FinancePartyType" NOT NULL,
	"party_id" uuid,
	"source_type" "FinanceSourceType" NOT NULL,
	"source_id" uuid,
	"total_amount" numeric(12, 2) NOT NULL,
	"paid_amount" numeric(12, 2) NOT NULL,
	"status" "FinancePayableStatus" NOT NULL,
	"due_date" timestamp,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_receivables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"receivable_no" varchar(100) NOT NULL,
	"party_type" "FinancePartyType" NOT NULL,
	"party_id" uuid,
	"source_type" "FinanceSourceType" NOT NULL,
	"source_id" uuid,
	"total_amount" numeric(12, 2) NOT NULL,
	"received_amount" numeric(12, 2) NOT NULL,
	"status" "FinanceReceivableStatus" NOT NULL,
	"due_date" timestamp,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_taxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"rate" numeric(5, 2) NOT NULL,
	"description" text,
	"status" "FinanceTaxStatus" NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "inventory_order_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"stock_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"stock_item_key" varchar(80) NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"status" "InventoryOrderAllocationStatus" NOT NULL,
	"created_by" uuid,
	"fulfilled_at" timestamp,
	"released_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_stocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"stock_item_key" varchar(80) NOT NULL,
	"total_quantity" numeric(14, 3) NOT NULL,
	"quantity_reserved" numeric(14, 3) NOT NULL,
	"low_stock_alert_qty" numeric(14, 3) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_stock_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"adjustment_no" varchar(100) NOT NULL,
	"adjustment_type" "InventoryAdjustmentType" NOT NULL,
	"reason" text,
	"status" "InventoryAdjustmentStatus" NOT NULL,
	"created_by" uuid,
	"approved_by" uuid,
	"deleted_by" uuid,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "inventory_stock_adjustment_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"adjustment_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"old_quantity" numeric(14, 3) NOT NULL,
	"adjustment_qty" numeric(14, 3) NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"stock_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"stock_item_key" varchar(80) NOT NULL,
	"movement_type" "InventoryMovementType" NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"reference_type" "InventoryReferenceType",
	"reference_id" uuid,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_stock_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"transfer_no" varchar(100) NOT NULL,
	"from_warehouse_id" uuid NOT NULL,
	"to_warehouse_id" uuid NOT NULL,
	"status" "InventoryTransferStatus" NOT NULL,
	"note" text,
	"created_by" uuid,
	"approved_by" uuid,
	"deleted_by" uuid,
	"shipped_at" timestamp,
	"received_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "inventory_stock_transfer_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"requested_quantity" numeric(14, 3) NOT NULL,
	"transferred_quantity" numeric(14, 3) NOT NULL,
	"received_quantity" numeric(14, 3) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_warehouse_stocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"stock_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"stock_item_key" varchar(80) NOT NULL,
	"total_quantity" numeric(14, 3) NOT NULL,
	"quantity_reserved" numeric(14, 3) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"order_id" uuid,
	"customer_id" uuid,
	"tax_id" uuid,
	"invoice_no" varchar(100) NOT NULL,
	"invoice_date" timestamp NOT NULL,
	"due_date" timestamp,
	"status" "InvoiceStatus" NOT NULL,
	"customer_name" varchar(150),
	"customer_phone" varchar(30),
	"customer_email" varchar(150),
	"billing_address_snapshot" jsonb,
	"subtotal" numeric(12, 2) NOT NULL,
	"discount_total" numeric(12, 2) NOT NULL,
	"tax_total" numeric(12, 2) NOT NULL,
	"tax_rate" numeric(5, 2) NOT NULL,
	"shipping_charge" numeric(12, 2) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"paid_amount" numeric(12, 2) NOT NULL,
	"note" text,
	"created_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"order_item_id" uuid,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"tax_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"discount_amount" numeric(12, 2) NOT NULL,
	"tax_amount" numeric(12, 2) NOT NULL,
	"tax_rate" numeric(5, 2) NOT NULL,
	"line_total" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"uploaded_by" uuid,
	"file_name" varchar(255) NOT NULL,
	"file_url" text NOT NULL,
	"file_type" "MediaFileType" NOT NULL,
	"mime_type" varchar(100),
	"file_size" integer,
	"alt_text" text,
	"status" "MediaAssetStatus" NOT NULL,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "media_asset_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"status" "MediaTagStatus" NOT NULL,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"customer_id" uuid,
	"warehouse_id" uuid NOT NULL,
	"tax_id" uuid,
	"order_no" varchar(100) NOT NULL,
	"order_type" "OrderType" NOT NULL,
	"order_source" "OrderSource" NOT NULL,
	"status" "OrderStatus" NOT NULL,
	"payment_status" "OrderPaymentStatus" NOT NULL,
	"is_cod" boolean DEFAULT false NOT NULL,
	"customer_name" varchar(150),
	"customer_phone" varchar(30),
	"customer_email" varchar(150),
	"shipping_address_snapshot" jsonb,
	"subtotal" numeric(12, 2) NOT NULL,
	"discount_total" numeric(12, 2) NOT NULL,
	"tax_total" numeric(12, 2) NOT NULL,
	"tax_rate" numeric(5, 2) NOT NULL,
	"shipping_charge" numeric(12, 2) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"paid_amount" numeric(12, 2) NOT NULL,
	"note" text,
	"created_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "order_carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"customer_id" uuid,
	"session_id" varchar(150),
	"status" "OrderCartStatus" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "order_cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"quantity" numeric(14, 3) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_discounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"discount_type" "OrderDiscountType" NOT NULL,
	"discount_source" "OrderDiscountSource" NOT NULL,
	"code" varchar(100),
	"amount" numeric(12, 2) NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"tax_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"discount_amount" numeric(12, 2) NOT NULL,
	"tax_amount" numeric(12, 2) NOT NULL,
	"tax_rate" numeric(5, 2) NOT NULL,
	"line_total" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"finance_account_id" uuid,
	"gateway_id" uuid,
	"gateway_config_id" uuid,
	"payment_no" varchar(100) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" "OrderPaymentMethod" NOT NULL,
	"payment_status" "OrderPaymentStatus" DEFAULT 'UNPAID' NOT NULL,
	"transaction_reference" varchar(150),
	"gateway_transaction_id" varchar(150),
	"gateway_session_id" varchar(150),
	"gateway_event_id" varchar(150),
	"gateway_payload" jsonb,
	"paid_at" timestamp,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"return_no" varchar(100) NOT NULL,
	"status" "OrderReturnStatus" DEFAULT 'REQUESTED' NOT NULL,
	"reason" text,
	"total_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"approved_by" uuid,
	"deleted_by" uuid,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "order_return_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"line_total" numeric(12, 2) NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_status_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"from_status" "OrderStatus",
	"to_status" "OrderStatus" NOT NULL,
	"note" text,
	"changed_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"subscription_id" uuid,
	"plan_id" uuid,
	"type" "PackagePaymentType" NOT NULL,
	"status" "PackagePaymentStatus" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency_code" varchar(10) NOT NULL,
	"metadata" jsonb,
	"expires_at" timestamp NOT NULL,
	"confirmed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"price" numeric(12, 2) NOT NULL,
	"billing_cycle" "PackageBillingCycle" NOT NULL,
	"currency_code" varchar(10) NOT NULL,
	"free_trial_days" integer NOT NULL,
	"is_default" boolean NOT NULL,
	"status" "PackageStatus" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "package_plan_features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package_plan_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"limit_key" "PackageLimitKey" NOT NULL,
	"limit_value" integer NOT NULL,
	"reset_cycle" "PackageResetCycle" NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"plan_snapshot" jsonb,
	"status" "PackageSubscriptionStatus" NOT NULL,
	"billing_cycle" "PackageBillingCycle" NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"currency_code" varchar(10) NOT NULL,
	"started_at" timestamp NOT NULL,
	"trial_ends_at" timestamp,
	"current_period_start" timestamp NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"ended_at" timestamp,
	"end_reason" text,
	"auto_renew" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package_tenant_credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"subscription_id" uuid,
	"payment_id" uuid,
	"type" "PackageCreditEntryType" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency_code" varchar(10) NOT NULL,
	"note" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package_usage_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"limit_key" "PackageLimitKey" NOT NULL,
	"used_value" integer DEFAULT 0 NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_gateways" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"code" "PaymentGatewayProvider" NOT NULL,
	"description" text,
	"status" "PaymentGatewayStatus" NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_gateway_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"gateway_id" uuid NOT NULL,
	"finance_account_id" uuid NOT NULL,
	"config_data" jsonb NOT NULL,
	"mode" "PaymentGatewayMode" NOT NULL,
	"status" "PaymentGatewayConfigStatus" NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "payment_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"gateway_id" uuid NOT NULL,
	"order_payment_id" uuid,
	"event_type" varchar(100) NOT NULL,
	"event_id" varchar(150),
	"payload" jsonb NOT NULL,
	"status" "PaymentWebhookStatus" NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"tax_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"slug" varchar(220) NOT NULL,
	"description" text,
	"sku" varchar(100) NOT NULL,
	"barcode" varchar(100) NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"weight" numeric(10, 2),
	"status" "CatalogProductStatus" NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "product_attributes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"status" "ProductSimpleStatus" NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "product_attribute_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"attribute_id" uuid NOT NULL,
	"value" varchar(150) NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "product_brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"logo_url" text,
	"status" "ProductSimpleStatus" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" varchar(150) NOT NULL,
	"description" text,
	"image_url" text,
	"status" "ProductSimpleStatus" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"image_url" text NOT NULL,
	"alt_text" text,
	"is_thumbnail" boolean NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "product_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"customer_id" uuid,
	"variant_id" uuid,
	"rating" integer NOT NULL,
	"title" varchar(150),
	"comment" text,
	"reviewer_name" varchar(150) NOT NULL,
	"reviewer_email" varchar(150),
	"reviewer_phone" varchar(30),
	"status" "ProductReviewStatus" NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "product_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"status" "ProductSimpleStatus" NOT NULL,
	"is_featured" boolean NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "product_tag_map" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"status" "ProductSimpleStatus" NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" varchar(100) NOT NULL,
	"barcode" varchar(100) NOT NULL,
	"title" varchar(200) NOT NULL,
	"price_override" numeric(12, 2),
	"weight" numeric(10, 2),
	"status" "ProductVariantStatus" NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "product_variant_attributes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"attribute_id" uuid NOT NULL,
	"attribute_value_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rbac_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"status" "CommonStatus" NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp (6) with time zone
);
--> statement-breakpoint
CREATE TABLE "rbac_role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"feature" "RbacFeature" NOT NULL,
	"action" "PermissionAction" NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rbac_user_role_map" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"status" "UserRoleMapStatus" NOT NULL,
	"assigned_by" uuid,
	"assigned_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp (6) with time zone,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"company_name" varchar(150),
	"email" varchar(150),
	"phone" varchar(30),
	"address" text,
	"city" varchar(100),
	"country" varchar(100),
	"status" "SupplierStatus" NOT NULL,
	"note" text,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "supplier_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"purchase_order_id" uuid,
	"tax_id" uuid,
	"invoice_no" varchar(100) NOT NULL,
	"invoice_date" timestamp NOT NULL,
	"due_date" timestamp,
	"status" "SupplierInvoiceStatus" NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"discount_total" numeric(12, 2) NOT NULL,
	"tax_total" numeric(12, 2) NOT NULL,
	"tax_rate" numeric(5, 2) NOT NULL,
	"shipping_cost" numeric(12, 2) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"paid_amount" numeric(12, 2) NOT NULL,
	"note" text,
	"created_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "supplier_invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_invoice_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"tax_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_cost" numeric(12, 2) NOT NULL,
	"discount_amount" numeric(12, 2) NOT NULL,
	"tax_amount" numeric(12, 2) NOT NULL,
	"tax_rate" numeric(5, 2) NOT NULL,
	"line_total" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"supplier_invoice_id" uuid NOT NULL,
	"payment_no" varchar(100) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_date" timestamp NOT NULL,
	"payment_method" "SupplierPaymentMethod" NOT NULL,
	"reference_no" varchar(150),
	"note" text,
	"created_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "supplier_product_map" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"item_key" varchar(80) NOT NULL,
	"supplier_sku" varchar(100),
	"last_purchase_price" numeric(12, 2),
	"min_order_quantity" numeric(14, 3),
	"lead_time_days" integer,
	"status" "SupplierProductMapStatus" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"tax_id" uuid,
	"purchase_order_no" varchar(100) NOT NULL,
	"order_date" timestamp NOT NULL,
	"expected_delivery_date" timestamp,
	"status" "SupplierPurchaseOrderStatus" NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"discount_total" numeric(12, 2) NOT NULL,
	"tax_total" numeric(12, 2) NOT NULL,
	"tax_rate" numeric(5, 2) NOT NULL,
	"shipping_cost" numeric(12, 2) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"note" text,
	"created_by" uuid,
	"approved_by" uuid,
	"deleted_by" uuid,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "supplier_purchase_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"tax_id" uuid NOT NULL,
	"quantity_ordered" numeric(14, 3) NOT NULL,
	"quantity_received" numeric(14, 3) NOT NULL,
	"unit_cost" numeric(12, 2) NOT NULL,
	"discount_amount" numeric(12, 2) NOT NULL,
	"tax_amount" numeric(12, 2) NOT NULL,
	"tax_rate" numeric(5, 2) NOT NULL,
	"line_total" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_purchase_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"purchase_order_id" uuid,
	"supplier_invoice_id" uuid,
	"warehouse_id" uuid NOT NULL,
	"tax_id" uuid,
	"return_no" varchar(100) NOT NULL,
	"return_date" timestamp NOT NULL,
	"status" "SupplierPurchaseReturnStatus" NOT NULL,
	"reason" text,
	"subtotal" numeric(12, 2) NOT NULL,
	"discount_total" numeric(12, 2) NOT NULL,
	"tax_total" numeric(12, 2) NOT NULL,
	"tax_rate" numeric(5, 2) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_purchase_return_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_return_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"tax_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_cost" numeric(12, 2) NOT NULL,
	"discount_amount" numeric(12, 2) NOT NULL,
	"tax_amount" numeric(12, 2) NOT NULL,
	"tax_rate" numeric(5, 2) NOT NULL,
	"line_total" numeric(12, 2) NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"business_id" uuid,
	"action" varchar(100) NOT NULL,
	"feature" varchar(100) NOT NULL,
	"entity_name" varchar(150) NOT NULL,
	"entity_id" varchar(100),
	"old_data" jsonb,
	"new_data" jsonb,
	"ip_address" varchar(100),
	"user_agent" text,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_email_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"otp_hash" text NOT NULL,
	"purpose" "OtpPurpose" NOT NULL,
	"attempt_count" integer NOT NULL,
	"expires_at" timestamp (6) with time zone NOT NULL,
	"verified_at" timestamp (6) with time zone,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_password_resets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"otp_hash" text NOT NULL,
	"attempt_count" integer NOT NULL,
	"expires_at" timestamp (6) with time zone NOT NULL,
	"used_at" timestamp (6) with time zone,
	"verified_at" timestamp (6) with time zone,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"business_id" uuid,
	"refresh_token_hash" text NOT NULL,
	"expires_at" timestamp (6) with time zone NOT NULL,
	"revoked_at" timestamp (6) with time zone,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "system_sessions_refresh_token_hash_unique" UNIQUE("refresh_token_hash")
);
--> statement-breakpoint
CREATE TABLE "system_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(30),
	"password_hash" text NOT NULL,
	"type" "SystemUserType" NOT NULL,
	"status" "SystemUserStatus" NOT NULL,
	"email_verified_at" timestamp (6) with time zone,
	"tenant_id" uuid,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp (6) with time zone,
	CONSTRAINT "system_users_email_unique" UNIQUE("email"),
	CONSTRAINT "system_users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "system_user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"image_url" text,
	"date_of_birth" date,
	"gender" "Gender",
	"address" text,
	"city" varchar(100),
	"country" varchar(100),
	"bio" text,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"deleted_by" uuid,
	"deleted_at" timestamp (6) with time zone,
	CONSTRAINT "system_user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "inventory_warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"phone" varchar(30),
	"address" text,
	"status" "WarehouseStatus" NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "websites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"current_version_id" uuid,
	"name" varchar(150) NOT NULL,
	"slug" varchar(180) NOT NULL,
	"status" "WebsiteStatus" NOT NULL,
	"template" "WebsiteTemplate" NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "websites_current_version_id_unique" UNIQUE("current_version_id")
);
--> statement-breakpoint
CREATE TABLE "website_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"header_config" jsonb,
	"footer_config" jsonb,
	"navigation_config" jsonb,
	"section_config" jsonb,
	"general_config" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "website_configs_website_id_unique" UNIQUE("website_id")
);
--> statement-breakpoint
CREATE TABLE "website_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"domain" varchar(255),
	"subdomain" varchar(255),
	"domain_type" "WebsiteDomainType" NOT NULL,
	"is_primary" boolean NOT NULL,
	"verification_status" "WebsiteDomainVerificationStatus" NOT NULL,
	"ssl_status" "WebsiteDomainSslStatus" NOT NULL,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_publish_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"version_no" integer NOT NULL,
	"snapshot_data" jsonb NOT NULL,
	"published_by" uuid,
	"published_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_seo_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"meta_title" varchar(255),
	"meta_description" text,
	"meta_keywords" text,
	"og_title" varchar(255),
	"og_description" text,
	"og_image_url" text,
	"canonical_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_theme_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"primary_color" varchar(30),
	"secondary_color" varchar(30),
	"accent_color" varchar(30),
	"font_family" varchar(100),
	"logo_url" text,
	"favicon_url" text,
	"custom_css" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "website_theme_settings_website_id_unique" UNIQUE("website_id")
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_owner_user_id_system_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."system_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_updated_by_system_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_brandings" ADD CONSTRAINT "business_brandings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_members" ADD CONSTRAINT "business_members_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_members" ADD CONSTRAINT "business_members_user_id_system_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."system_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_members" ADD CONSTRAINT "business_members_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_default_warehouse_id_inventory_warehouses_id_fk" FOREIGN KEY ("default_warehouse_id") REFERENCES "public"."inventory_warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_default_finance_account_id_finance_accounts_id_fk" FOREIGN KEY ("default_finance_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_default_unit_id_product_units_id_fk" FOREIGN KEY ("default_unit_id") REFERENCES "public"."product_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_default_tax_id_finance_taxes_id_fk" FOREIGN KEY ("default_tax_id") REFERENCES "public"."finance_taxes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_configs" ADD CONSTRAINT "courier_configs_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_configs" ADD CONSTRAINT "courier_configs_courier_id_couriers_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."couriers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_configs" ADD CONSTRAINT "courier_configs_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_configs" ADD CONSTRAINT "courier_configs_updated_by_system_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_configs" ADD CONSTRAINT "courier_configs_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_delivery_zones" ADD CONSTRAINT "courier_delivery_zones_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_delivery_zones" ADD CONSTRAINT "courier_delivery_zones_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_delivery_zone_areas" ADD CONSTRAINT "courier_delivery_zone_areas_delivery_zone_id_courier_delivery_zones_id_fk" FOREIGN KEY ("delivery_zone_id") REFERENCES "public"."courier_delivery_zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_receivables" ADD CONSTRAINT "courier_receivables_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_receivables" ADD CONSTRAINT "courier_receivables_courier_id_couriers_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."couriers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_receivables" ADD CONSTRAINT "courier_receivables_shipment_id_courier_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."courier_shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_settlements" ADD CONSTRAINT "courier_settlements_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_settlements" ADD CONSTRAINT "courier_settlements_courier_id_couriers_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."couriers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_settlements" ADD CONSTRAINT "courier_settlements_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_settlements" ADD CONSTRAINT "courier_settlements_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_settlement_items" ADD CONSTRAINT "courier_settlement_items_settlement_id_courier_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."courier_settlements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_settlement_items" ADD CONSTRAINT "courier_settlement_items_receivable_id_courier_receivables_id_fk" FOREIGN KEY ("receivable_id") REFERENCES "public"."courier_receivables"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_settlement_items" ADD CONSTRAINT "courier_settlement_items_shipment_id_courier_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."courier_shipments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_shipments" ADD CONSTRAINT "courier_shipments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_shipments" ADD CONSTRAINT "courier_shipments_courier_id_couriers_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."couriers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_shipments" ADD CONSTRAINT "courier_shipments_courier_config_id_courier_configs_id_fk" FOREIGN KEY ("courier_config_id") REFERENCES "public"."courier_configs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_shipments" ADD CONSTRAINT "courier_shipments_delivery_zone_id_courier_delivery_zones_id_fk" FOREIGN KEY ("delivery_zone_id") REFERENCES "public"."courier_delivery_zones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_shipments" ADD CONSTRAINT "courier_shipments_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_shipments" ADD CONSTRAINT "courier_shipments_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_shipment_items" ADD CONSTRAINT "courier_shipment_items_shipment_id_courier_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."courier_shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_shipping_charges" ADD CONSTRAINT "courier_shipping_charges_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_shipping_charges" ADD CONSTRAINT "courier_shipping_charges_delivery_zone_id_courier_delivery_zones_id_fk" FOREIGN KEY ("delivery_zone_id") REFERENCES "public"."courier_delivery_zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_shipping_charges" ADD CONSTRAINT "courier_shipping_charges_courier_id_couriers_id_fk" FOREIGN KEY ("courier_id") REFERENCES "public"."couriers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_updated_by_system_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_accounts" ADD CONSTRAINT "customer_accounts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_accounts" ADD CONSTRAINT "customer_accounts_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_accounts" ADD CONSTRAINT "customer_accounts_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_email_verifications" ADD CONSTRAINT "customer_email_verifications_account_id_customer_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."customer_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_password_resets" ADD CONSTRAINT "customer_password_resets_account_id_customer_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."customer_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_account_id_customer_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."customer_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_wishlist_items" ADD CONSTRAINT "customer_wishlist_items_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_wishlist_items" ADD CONSTRAINT "customer_wishlist_items_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_wishlist_items" ADD CONSTRAINT "customer_wishlist_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_wishlist_items" ADD CONSTRAINT "customer_wishlist_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_accounts" ADD CONSTRAINT "finance_accounts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_accounts" ADD CONSTRAINT "finance_accounts_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_accounts" ADD CONSTRAINT "finance_accounts_updated_by_system_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_accounts" ADD CONSTRAINT "finance_accounts_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_account_transactions" ADD CONSTRAINT "finance_account_transactions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_account_transactions" ADD CONSTRAINT "finance_account_transactions_account_id_finance_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_account_transactions" ADD CONSTRAINT "finance_account_transactions_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD CONSTRAINT "finance_expenses_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD CONSTRAINT "finance_expenses_account_id_finance_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD CONSTRAINT "finance_expenses_expense_category_id_finance_expense_categories_id_fk" FOREIGN KEY ("expense_category_id") REFERENCES "public"."finance_expense_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD CONSTRAINT "finance_expenses_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD CONSTRAINT "finance_expenses_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_expense_categories" ADD CONSTRAINT "finance_expense_categories_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_expense_categories" ADD CONSTRAINT "finance_expense_categories_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_journal_entries" ADD CONSTRAINT "finance_journal_entries_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_journal_entry_lines" ADD CONSTRAINT "finance_journal_entry_lines_journal_entry_id_finance_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."finance_journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_journal_entry_lines" ADD CONSTRAINT "finance_journal_entry_lines_account_id_finance_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_payables" ADD CONSTRAINT "finance_payables_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_receivables" ADD CONSTRAINT "finance_receivables_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_taxes" ADD CONSTRAINT "finance_taxes_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_taxes" ADD CONSTRAINT "finance_taxes_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_taxes" ADD CONSTRAINT "finance_taxes_updated_by_system_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_taxes" ADD CONSTRAINT "finance_taxes_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_order_allocations" ADD CONSTRAINT "inventory_order_allocations_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_order_allocations" ADD CONSTRAINT "inventory_order_allocations_stock_id_inventory_stocks_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."inventory_stocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_order_allocations" ADD CONSTRAINT "inventory_order_allocations_warehouse_id_inventory_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."inventory_warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stocks" ADD CONSTRAINT "inventory_stocks_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stocks" ADD CONSTRAINT "inventory_stocks_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stocks" ADD CONSTRAINT "inventory_stocks_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock_adjustments" ADD CONSTRAINT "inventory_stock_adjustments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock_adjustments" ADD CONSTRAINT "inventory_stock_adjustments_warehouse_id_inventory_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."inventory_warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock_adjustments" ADD CONSTRAINT "inventory_stock_adjustments_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock_adjustments" ADD CONSTRAINT "inventory_stock_adjustments_approved_by_system_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock_adjustments" ADD CONSTRAINT "inventory_stock_adjustments_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock_adjustment_items" ADD CONSTRAINT "inventory_stock_adjustment_items_adjustment_id_inventory_stock_adjustments_id_fk" FOREIGN KEY ("adjustment_id") REFERENCES "public"."inventory_stock_adjustments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock_movements" ADD CONSTRAINT "inventory_stock_movements_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock_movements" ADD CONSTRAINT "inventory_stock_movements_stock_id_inventory_stocks_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."inventory_stocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock_movements" ADD CONSTRAINT "inventory_stock_movements_warehouse_id_inventory_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."inventory_warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock_movements" ADD CONSTRAINT "inventory_stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock_movements" ADD CONSTRAINT "inventory_stock_movements_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock_transfers" ADD CONSTRAINT "inventory_stock_transfers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock_transfers" ADD CONSTRAINT "inventory_stock_transfers_from_warehouse_id_inventory_warehouses_id_fk" FOREIGN KEY ("from_warehouse_id") REFERENCES "public"."inventory_warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock_transfers" ADD CONSTRAINT "inventory_stock_transfers_to_warehouse_id_inventory_warehouses_id_fk" FOREIGN KEY ("to_warehouse_id") REFERENCES "public"."inventory_warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock_transfers" ADD CONSTRAINT "inventory_stock_transfers_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock_transfers" ADD CONSTRAINT "inventory_stock_transfers_approved_by_system_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock_transfers" ADD CONSTRAINT "inventory_stock_transfers_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock_transfer_items" ADD CONSTRAINT "inventory_stock_transfer_items_transfer_id_inventory_stock_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."inventory_stock_transfers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_warehouse_stocks" ADD CONSTRAINT "inventory_warehouse_stocks_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_warehouse_stocks" ADD CONSTRAINT "inventory_warehouse_stocks_stock_id_inventory_stocks_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."inventory_stocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_warehouse_stocks" ADD CONSTRAINT "inventory_warehouse_stocks_warehouse_id_inventory_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."inventory_warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tax_id_finance_taxes_id_fk" FOREIGN KEY ("tax_id") REFERENCES "public"."finance_taxes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_tax_id_finance_taxes_id_fk" FOREIGN KEY ("tax_id") REFERENCES "public"."finance_taxes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_asset_tags" ADD CONSTRAINT "media_asset_tags_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_asset_tags" ADD CONSTRAINT "media_asset_tags_tag_id_media_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."media_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_tags" ADD CONSTRAINT "media_tags_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_tags" ADD CONSTRAINT "media_tags_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_warehouse_id_inventory_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."inventory_warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tax_id_finance_taxes_id_fk" FOREIGN KEY ("tax_id") REFERENCES "public"."finance_taxes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_carts" ADD CONSTRAINT "order_carts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_carts" ADD CONSTRAINT "order_carts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_cart_items" ADD CONSTRAINT "order_cart_items_cart_id_order_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."order_carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_discounts" ADD CONSTRAINT "order_discounts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_tax_id_finance_taxes_id_fk" FOREIGN KEY ("tax_id") REFERENCES "public"."finance_taxes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_finance_account_id_finance_accounts_id_fk" FOREIGN KEY ("finance_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_gateway_id_payment_gateways_id_fk" FOREIGN KEY ("gateway_id") REFERENCES "public"."payment_gateways"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_gateway_config_id_payment_gateway_configs_id_fk" FOREIGN KEY ("gateway_config_id") REFERENCES "public"."payment_gateway_configs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_approved_by_system_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_return_items" ADD CONSTRAINT "order_return_items_return_id_order_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."order_returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_return_items" ADD CONSTRAINT "order_return_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_logs" ADD CONSTRAINT "order_status_logs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_payments" ADD CONSTRAINT "package_payments_tenant_id_system_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."system_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_payments" ADD CONSTRAINT "package_payments_subscription_id_package_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."package_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_payments" ADD CONSTRAINT "package_payments_plan_id_package_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."package_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_plans" ADD CONSTRAINT "package_plans_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_plan_features" ADD CONSTRAINT "package_plan_features_package_id_package_plans_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."package_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_plan_limits" ADD CONSTRAINT "package_plan_limits_package_id_package_plans_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."package_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_subscriptions" ADD CONSTRAINT "package_subscriptions_tenant_id_system_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."system_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_subscriptions" ADD CONSTRAINT "package_subscriptions_package_id_package_plans_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."package_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_tenant_credit_ledger" ADD CONSTRAINT "package_tenant_credit_ledger_tenant_id_system_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."system_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_tenant_credit_ledger" ADD CONSTRAINT "package_tenant_credit_ledger_subscription_id_package_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."package_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_tenant_credit_ledger" ADD CONSTRAINT "package_tenant_credit_ledger_payment_id_package_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."package_payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_usage_counters" ADD CONSTRAINT "package_usage_counters_subscription_id_package_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."package_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_gateway_configs" ADD CONSTRAINT "payment_gateway_configs_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_gateway_configs" ADD CONSTRAINT "payment_gateway_configs_gateway_id_payment_gateways_id_fk" FOREIGN KEY ("gateway_id") REFERENCES "public"."payment_gateways"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_gateway_configs" ADD CONSTRAINT "payment_gateway_configs_finance_account_id_finance_accounts_id_fk" FOREIGN KEY ("finance_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_gateway_configs" ADD CONSTRAINT "payment_gateway_configs_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_gateway_configs" ADD CONSTRAINT "payment_gateway_configs_updated_by_system_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_gateway_configs" ADD CONSTRAINT "payment_gateway_configs_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_gateway_id_payment_gateways_id_fk" FOREIGN KEY ("gateway_id") REFERENCES "public"."payment_gateways"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_order_payment_id_order_payments_id_fk" FOREIGN KEY ("order_payment_id") REFERENCES "public"."order_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_product_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."product_brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_unit_id_product_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."product_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tax_id_finance_taxes_id_fk" FOREIGN KEY ("tax_id") REFERENCES "public"."finance_taxes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_updated_by_system_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_updated_by_system_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_attribute_id_product_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."product_attributes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_updated_by_system_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_brands" ADD CONSTRAINT "product_brands_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_brands" ADD CONSTRAINT "product_brands_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_brands" ADD CONSTRAINT "product_brands_updated_by_system_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_brands" ADD CONSTRAINT "product_brands_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parent_id_product_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."product_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_updated_by_system_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_updated_by_system_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_updated_by_system_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_updated_by_system_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tag_map" ADD CONSTRAINT "product_tag_map_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tag_map" ADD CONSTRAINT "product_tag_map_tag_id_product_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."product_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_units" ADD CONSTRAINT "product_units_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_units" ADD CONSTRAINT "product_units_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_units" ADD CONSTRAINT "product_units_updated_by_system_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_units" ADD CONSTRAINT "product_units_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_updated_by_system_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_attributes" ADD CONSTRAINT "product_variant_attributes_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_attributes" ADD CONSTRAINT "product_variant_attributes_attribute_id_product_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."product_attributes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_attributes" ADD CONSTRAINT "product_variant_attributes_attribute_value_id_product_attribute_values_id_fk" FOREIGN KEY ("attribute_value_id") REFERENCES "public"."product_attribute_values"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_roles" ADD CONSTRAINT "rbac_roles_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_roles" ADD CONSTRAINT "rbac_roles_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_roles" ADD CONSTRAINT "rbac_roles_updated_by_system_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_roles" ADD CONSTRAINT "rbac_roles_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_role_permissions" ADD CONSTRAINT "rbac_role_permissions_role_id_rbac_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."rbac_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_user_role_map" ADD CONSTRAINT "rbac_user_role_map_user_id_system_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."system_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_user_role_map" ADD CONSTRAINT "rbac_user_role_map_role_id_rbac_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."rbac_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_user_role_map" ADD CONSTRAINT "rbac_user_role_map_assigned_by_system_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_updated_by_system_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_purchase_order_id_supplier_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."supplier_purchase_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_tax_id_finance_taxes_id_fk" FOREIGN KEY ("tax_id") REFERENCES "public"."finance_taxes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_items" ADD CONSTRAINT "supplier_invoice_items_supplier_invoice_id_supplier_invoices_id_fk" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_items" ADD CONSTRAINT "supplier_invoice_items_tax_id_finance_taxes_id_fk" FOREIGN KEY ("tax_id") REFERENCES "public"."finance_taxes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplier_invoice_id_supplier_invoices_id_fk" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_product_map" ADD CONSTRAINT "supplier_product_map_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_product_map" ADD CONSTRAINT "supplier_product_map_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_purchase_orders" ADD CONSTRAINT "supplier_purchase_orders_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_purchase_orders" ADD CONSTRAINT "supplier_purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_purchase_orders" ADD CONSTRAINT "supplier_purchase_orders_tax_id_finance_taxes_id_fk" FOREIGN KEY ("tax_id") REFERENCES "public"."finance_taxes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_purchase_orders" ADD CONSTRAINT "supplier_purchase_orders_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_purchase_orders" ADD CONSTRAINT "supplier_purchase_orders_approved_by_system_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_purchase_orders" ADD CONSTRAINT "supplier_purchase_orders_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_purchase_order_items" ADD CONSTRAINT "supplier_purchase_order_items_purchase_order_id_supplier_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."supplier_purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_purchase_order_items" ADD CONSTRAINT "supplier_purchase_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_purchase_order_items" ADD CONSTRAINT "supplier_purchase_order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_purchase_order_items" ADD CONSTRAINT "supplier_purchase_order_items_tax_id_finance_taxes_id_fk" FOREIGN KEY ("tax_id") REFERENCES "public"."finance_taxes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_purchase_returns" ADD CONSTRAINT "supplier_purchase_returns_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_purchase_returns" ADD CONSTRAINT "supplier_purchase_returns_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_purchase_returns" ADD CONSTRAINT "supplier_purchase_returns_purchase_order_id_supplier_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."supplier_purchase_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_purchase_returns" ADD CONSTRAINT "supplier_purchase_returns_supplier_invoice_id_supplier_invoices_id_fk" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_purchase_returns" ADD CONSTRAINT "supplier_purchase_returns_tax_id_finance_taxes_id_fk" FOREIGN KEY ("tax_id") REFERENCES "public"."finance_taxes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_purchase_return_items" ADD CONSTRAINT "supplier_purchase_return_items_purchase_return_id_supplier_purchase_returns_id_fk" FOREIGN KEY ("purchase_return_id") REFERENCES "public"."supplier_purchase_returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_purchase_return_items" ADD CONSTRAINT "supplier_purchase_return_items_tax_id_finance_taxes_id_fk" FOREIGN KEY ("tax_id") REFERENCES "public"."finance_taxes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_audit_logs" ADD CONSTRAINT "system_audit_logs_user_id_system_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_audit_logs" ADD CONSTRAINT "system_audit_logs_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_email_verifications" ADD CONSTRAINT "system_email_verifications_user_id_system_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."system_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_password_resets" ADD CONSTRAINT "system_password_resets_user_id_system_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."system_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_sessions" ADD CONSTRAINT "system_sessions_user_id_system_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."system_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_sessions" ADD CONSTRAINT "system_sessions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_users" ADD CONSTRAINT "system_users_tenant_id_system_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_users" ADD CONSTRAINT "system_users_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_users" ADD CONSTRAINT "system_users_updated_by_system_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_users" ADD CONSTRAINT "system_users_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_user_profiles" ADD CONSTRAINT "system_user_profiles_user_id_system_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."system_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_user_profiles" ADD CONSTRAINT "system_user_profiles_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_warehouses" ADD CONSTRAINT "inventory_warehouses_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_warehouses" ADD CONSTRAINT "inventory_warehouses_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_warehouses" ADD CONSTRAINT "inventory_warehouses_updated_by_system_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_warehouses" ADD CONSTRAINT "inventory_warehouses_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "websites" ADD CONSTRAINT "websites_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "websites" ADD CONSTRAINT "websites_current_version_id_website_publish_versions_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."website_publish_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "websites" ADD CONSTRAINT "websites_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "websites" ADD CONSTRAINT "websites_updated_by_system_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "websites" ADD CONSTRAINT "websites_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_configs" ADD CONSTRAINT "website_configs_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_domains" ADD CONSTRAINT "website_domains_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_publish_versions" ADD CONSTRAINT "website_publish_versions_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_seo_settings" ADD CONSTRAINT "website_seo_settings_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_theme_settings" ADD CONSTRAINT "website_theme_settings_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "businesses_name_deleted_at_unique" ON "businesses" USING btree ("name") WHERE "businesses"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "businesses_slug_owner_user_id_unique" ON "businesses" USING btree ("slug","owner_user_id") WHERE "businesses"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "businesses_owner_user_id_idx" ON "businesses" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "businesses_status_idx" ON "businesses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "businesses_deleted_at_idx" ON "businesses" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "business_members_business_id_user_id_unique" ON "business_members" USING btree ("business_id","user_id") WHERE "business_members"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "business_members_business_id_idx" ON "business_members" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "business_members_user_id_idx" ON "business_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "business_members_status_idx" ON "business_members" USING btree ("status");--> statement-breakpoint
CREATE INDEX "business_members_deleted_at_idx" ON "business_members" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "business_settings_default_warehouse_id_idx" ON "business_settings" USING btree ("default_warehouse_id");--> statement-breakpoint
CREATE INDEX "business_settings_default_finance_account_id_idx" ON "business_settings" USING btree ("default_finance_account_id");--> statement-breakpoint
CREATE INDEX "business_settings_default_unit_id_idx" ON "business_settings" USING btree ("default_unit_id");--> statement-breakpoint
CREATE INDEX "business_settings_default_tax_id_idx" ON "business_settings" USING btree ("default_tax_id");--> statement-breakpoint
CREATE UNIQUE INDEX "courier_couriers_name_unique" ON "couriers" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "courier_couriers_code_unique" ON "couriers" USING btree ("code");--> statement-breakpoint
CREATE INDEX "courier_couriers_status_idx" ON "couriers" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "courier_configs_business_courier_active_unique" ON "courier_configs" USING btree ("business_id","courier_id") WHERE "courier_configs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "courier_configs_business_id_idx" ON "courier_configs" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "courier_configs_courier_id_idx" ON "courier_configs" USING btree ("courier_id");--> statement-breakpoint
CREATE INDEX "courier_configs_status_idx" ON "courier_configs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "courier_delivery_zones_business_id_name_active_unique" ON "courier_delivery_zones" USING btree ("business_id","name") WHERE "courier_delivery_zones"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "courier_delivery_zones_business_id_idx" ON "courier_delivery_zones" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "courier_delivery_zones_status_idx" ON "courier_delivery_zones" USING btree ("status");--> statement-breakpoint
CREATE INDEX "courier_delivery_zone_areas_delivery_zone_id_idx" ON "courier_delivery_zone_areas" USING btree ("delivery_zone_id");--> statement-breakpoint
CREATE INDEX "courier_delivery_zone_areas_city_idx" ON "courier_delivery_zone_areas" USING btree ("city");--> statement-breakpoint
CREATE INDEX "courier_receivables_business_id_idx" ON "courier_receivables" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "courier_receivables_courier_id_idx" ON "courier_receivables" USING btree ("courier_id");--> statement-breakpoint
CREATE INDEX "courier_receivables_order_id_idx" ON "courier_receivables" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "courier_receivables_status_idx" ON "courier_receivables" USING btree ("status");--> statement-breakpoint
CREATE INDEX "courier_receivables_expected_settlement_date_idx" ON "courier_receivables" USING btree ("expected_settlement_date");--> statement-breakpoint
CREATE UNIQUE INDEX "courier_settlements_business_settlement_no_active_unique" ON "courier_settlements" USING btree ("business_id","settlement_no") WHERE "courier_settlements"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "courier_settlements_business_id_idx" ON "courier_settlements" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "courier_settlements_courier_id_idx" ON "courier_settlements" USING btree ("courier_id");--> statement-breakpoint
CREATE INDEX "courier_settlements_settlement_date_idx" ON "courier_settlements" USING btree ("settlement_date");--> statement-breakpoint
CREATE INDEX "courier_settlements_status_idx" ON "courier_settlements" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "courier_settlement_items_receivable_id_unique" ON "courier_settlement_items" USING btree ("receivable_id");--> statement-breakpoint
CREATE INDEX "courier_settlement_items_settlement_id_idx" ON "courier_settlement_items" USING btree ("settlement_id");--> statement-breakpoint
CREATE INDEX "courier_settlement_items_shipment_id_idx" ON "courier_settlement_items" USING btree ("shipment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "courier_shipments_business_id_shipment_no_active_unique" ON "courier_shipments" USING btree ("business_id","shipment_no") WHERE "courier_shipments"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "courier_shipments_consignment_id_active_unique" ON "courier_shipments" USING btree ("consignment_id") WHERE "courier_shipments"."consignment_id" IS NOT NULL AND "courier_shipments"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "courier_shipments_business_id_idx" ON "courier_shipments" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "courier_shipments_order_id_idx" ON "courier_shipments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "courier_shipments_courier_id_idx" ON "courier_shipments" USING btree ("courier_id");--> statement-breakpoint
CREATE INDEX "courier_shipments_courier_config_id_idx" ON "courier_shipments" USING btree ("courier_config_id");--> statement-breakpoint
CREATE INDEX "courier_shipments_delivery_zone_id_idx" ON "courier_shipments" USING btree ("delivery_zone_id");--> statement-breakpoint
CREATE INDEX "courier_shipments_status_idx" ON "courier_shipments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "courier_shipments_tracking_code_idx" ON "courier_shipments" USING btree ("tracking_code");--> statement-breakpoint
CREATE INDEX "courier_shipment_items_shipment_id_idx" ON "courier_shipment_items" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "courier_shipment_items_order_item_id_idx" ON "courier_shipment_items" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "courier_shipment_items_product_id_idx" ON "courier_shipment_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "courier_shipment_items_variant_id_idx" ON "courier_shipment_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "courier_shipping_charges_business_id_idx" ON "courier_shipping_charges" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "courier_shipping_charges_delivery_zone_id_idx" ON "courier_shipping_charges" USING btree ("delivery_zone_id");--> statement-breakpoint
CREATE INDEX "courier_shipping_charges_courier_id_idx" ON "courier_shipping_charges" USING btree ("courier_id");--> statement-breakpoint
CREATE INDEX "courier_shipping_charges_status_idx" ON "courier_shipping_charges" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_business_id_email_active_unique" ON "customers" USING btree ("business_id","email") WHERE "customers"."email" IS NOT NULL AND "customers"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_business_id_phone_active_unique" ON "customers" USING btree ("business_id","phone") WHERE "customers"."phone" IS NOT NULL AND "customers"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "customers_business_id_idx" ON "customers" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "customers_business_id_status_idx" ON "customers" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "customers_phone_idx" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "customers_email_idx" ON "customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "customers_status_idx" ON "customers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "customers_deleted_at_idx" ON "customers" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_accounts_customer_id_active_unique" ON "customer_accounts" USING btree ("customer_id") WHERE "customer_accounts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_accounts_website_id_email_active_unique" ON "customer_accounts" USING btree ("website_id","email") WHERE "customer_accounts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "customer_accounts_customer_id_idx" ON "customer_accounts" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_accounts_website_id_idx" ON "customer_accounts" USING btree ("website_id");--> statement-breakpoint
CREATE INDEX "customer_accounts_email_idx" ON "customer_accounts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "customer_accounts_deleted_at_idx" ON "customer_accounts" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_addresses_one_default_active_unique" ON "customer_addresses" USING btree ("customer_id") WHERE "customer_addresses"."is_default" = true AND "customer_addresses"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "customer_addresses_customer_id_idx" ON "customer_addresses" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_addresses_address_type_idx" ON "customer_addresses" USING btree ("address_type");--> statement-breakpoint
CREATE INDEX "customer_addresses_is_default_idx" ON "customer_addresses" USING btree ("is_default");--> statement-breakpoint
CREATE INDEX "customer_addresses_deleted_at_idx" ON "customer_addresses" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "customer_email_verifications_account_id_idx" ON "customer_email_verifications" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "customer_email_verifications_account_id_purpose_idx" ON "customer_email_verifications" USING btree ("account_id","purpose");--> statement-breakpoint
CREATE INDEX "customer_email_verifications_purpose_idx" ON "customer_email_verifications" USING btree ("purpose");--> statement-breakpoint
CREATE INDEX "customer_email_verifications_expires_at_idx" ON "customer_email_verifications" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "customer_email_verifications_verified_at_idx" ON "customer_email_verifications" USING btree ("verified_at");--> statement-breakpoint
CREATE INDEX "customer_password_resets_account_id_idx" ON "customer_password_resets" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "customer_password_resets_expires_at_idx" ON "customer_password_resets" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "customer_password_resets_used_at_idx" ON "customer_password_resets" USING btree ("used_at");--> statement-breakpoint
CREATE INDEX "customer_password_resets_verified_at_idx" ON "customer_password_resets" USING btree ("verified_at");--> statement-breakpoint
CREATE INDEX "customer_sessions_account_id_idx" ON "customer_sessions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "customer_sessions_website_id_idx" ON "customer_sessions" USING btree ("website_id");--> statement-breakpoint
CREATE INDEX "customer_sessions_expires_at_idx" ON "customer_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "customer_sessions_revoked_at_idx" ON "customer_sessions" USING btree ("revoked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_wishlist_customer_product_no_variant_unique" ON "customer_wishlist_items" USING btree ("business_id","customer_id","product_id") WHERE "customer_wishlist_items"."variant_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_wishlist_customer_product_variant_unique" ON "customer_wishlist_items" USING btree ("business_id","customer_id","product_id","variant_id") WHERE "customer_wishlist_items"."variant_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "customer_wishlist_business_id_idx" ON "customer_wishlist_items" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "customer_wishlist_customer_id_idx" ON "customer_wishlist_items" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_wishlist_product_id_idx" ON "customer_wishlist_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "customer_wishlist_variant_id_idx" ON "customer_wishlist_items" USING btree ("variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_accounts_business_id_name_deleted_at_unique" ON "finance_accounts" USING btree ("business_id","name") WHERE "finance_accounts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "finance_accounts_business_id_idx" ON "finance_accounts" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "finance_accounts_account_type_idx" ON "finance_accounts" USING btree ("account_type");--> statement-breakpoint
CREATE INDEX "finance_accounts_status_idx" ON "finance_accounts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_account_transactions_business_id_transaction_no_unique" ON "finance_account_transactions" USING btree ("business_id","transaction_no");--> statement-breakpoint
CREATE INDEX "finance_account_transactions_business_id_idx" ON "finance_account_transactions" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "finance_account_transactions_account_id_idx" ON "finance_account_transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "finance_account_transactions_transaction_type_idx" ON "finance_account_transactions" USING btree ("transaction_type");--> statement-breakpoint
CREATE INDEX "finance_account_transactions_reference_type_reference_id_idx" ON "finance_account_transactions" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "finance_account_transactions_created_at_idx" ON "finance_account_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_expenses_business_id_expense_no_deleted_at_unique" ON "finance_expenses" USING btree ("business_id","expense_no") WHERE "finance_expenses"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "finance_expenses_business_id_idx" ON "finance_expenses" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "finance_expenses_account_id_idx" ON "finance_expenses" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "finance_expenses_expense_category_id_idx" ON "finance_expenses" USING btree ("expense_category_id");--> statement-breakpoint
CREATE INDEX "finance_expenses_status_idx" ON "finance_expenses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "finance_expenses_expense_date_idx" ON "finance_expenses" USING btree ("expense_date");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_expense_categories_business_id_name_deleted_at_unique" ON "finance_expense_categories" USING btree ("business_id","name") WHERE "finance_expense_categories"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "finance_expense_categories_business_id_idx" ON "finance_expense_categories" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "finance_expense_categories_status_idx" ON "finance_expense_categories" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_journal_entries_business_id_journal_no_unique" ON "finance_journal_entries" USING btree ("business_id","journal_no");--> statement-breakpoint
CREATE INDEX "finance_journal_entries_business_id_idx" ON "finance_journal_entries" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "finance_journal_entries_journal_date_idx" ON "finance_journal_entries" USING btree ("journal_date");--> statement-breakpoint
CREATE INDEX "finance_journal_entries_reference_type_reference_id_idx" ON "finance_journal_entries" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "finance_journal_entry_lines_journal_entry_id_idx" ON "finance_journal_entry_lines" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "finance_journal_entry_lines_account_id_idx" ON "finance_journal_entry_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "finance_journal_entry_lines_entry_type_idx" ON "finance_journal_entry_lines" USING btree ("entry_type");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_payables_business_id_payable_no_unique" ON "finance_payables" USING btree ("business_id","payable_no");--> statement-breakpoint
CREATE INDEX "finance_payables_business_id_idx" ON "finance_payables" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "finance_payables_party_type_party_id_idx" ON "finance_payables" USING btree ("party_type","party_id");--> statement-breakpoint
CREATE INDEX "finance_payables_source_type_source_id_idx" ON "finance_payables" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "finance_payables_status_idx" ON "finance_payables" USING btree ("status");--> statement-breakpoint
CREATE INDEX "finance_payables_due_date_idx" ON "finance_payables" USING btree ("due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_receivables_business_id_receivable_no_unique" ON "finance_receivables" USING btree ("business_id","receivable_no");--> statement-breakpoint
CREATE INDEX "finance_receivables_business_id_idx" ON "finance_receivables" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "finance_receivables_party_type_party_id_idx" ON "finance_receivables" USING btree ("party_type","party_id");--> statement-breakpoint
CREATE INDEX "finance_receivables_source_type_source_id_idx" ON "finance_receivables" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "finance_receivables_status_idx" ON "finance_receivables" USING btree ("status");--> statement-breakpoint
CREATE INDEX "finance_receivables_due_date_idx" ON "finance_receivables" USING btree ("due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_taxes_business_id_name_deleted_at_unique" ON "finance_taxes" USING btree ("business_id","name") WHERE "finance_taxes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "finance_taxes_business_id_idx" ON "finance_taxes" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "finance_taxes_status_idx" ON "finance_taxes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "finance_taxes_deleted_at_idx" ON "finance_taxes" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "inventory_order_allocations_business_id_idx" ON "inventory_order_allocations" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "inventory_order_allocations_order_id_idx" ON "inventory_order_allocations" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "inventory_order_allocations_order_item_id_idx" ON "inventory_order_allocations" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "inventory_order_allocations_stock_id_idx" ON "inventory_order_allocations" USING btree ("stock_id");--> statement-breakpoint
CREATE INDEX "inventory_order_allocations_warehouse_id_idx" ON "inventory_order_allocations" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "inventory_order_allocations_product_id_idx" ON "inventory_order_allocations" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "inventory_order_allocations_variant_id_idx" ON "inventory_order_allocations" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "inventory_order_allocations_stock_item_key_idx" ON "inventory_order_allocations" USING btree ("stock_item_key");--> statement-breakpoint
CREATE INDEX "inventory_order_allocations_status_idx" ON "inventory_order_allocations" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_stocks_business_id_stock_item_key_unique" ON "inventory_stocks" USING btree ("business_id","stock_item_key");--> statement-breakpoint
CREATE INDEX "inventory_stocks_business_id_idx" ON "inventory_stocks" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "inventory_stocks_product_id_idx" ON "inventory_stocks" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "inventory_stocks_variant_id_idx" ON "inventory_stocks" USING btree ("variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_stock_adjustments_business_id_adjustment_no_deleted_at_unique" ON "inventory_stock_adjustments" USING btree ("business_id","adjustment_no") WHERE "inventory_stock_adjustments"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "inventory_stock_adjustments_business_id_idx" ON "inventory_stock_adjustments" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "inventory_stock_adjustments_warehouse_id_idx" ON "inventory_stock_adjustments" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "inventory_stock_adjustments_adjustment_type_idx" ON "inventory_stock_adjustments" USING btree ("adjustment_type");--> statement-breakpoint
CREATE INDEX "inventory_stock_adjustments_status_idx" ON "inventory_stock_adjustments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "inventory_stock_adjustment_items_adjustment_id_idx" ON "inventory_stock_adjustment_items" USING btree ("adjustment_id");--> statement-breakpoint
CREATE INDEX "inventory_stock_adjustment_items_product_id_idx" ON "inventory_stock_adjustment_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "inventory_stock_adjustment_items_variant_id_idx" ON "inventory_stock_adjustment_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "inventory_stock_movements_business_id_idx" ON "inventory_stock_movements" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "inventory_stock_movements_stock_id_idx" ON "inventory_stock_movements" USING btree ("stock_id");--> statement-breakpoint
CREATE INDEX "inventory_stock_movements_warehouse_id_idx" ON "inventory_stock_movements" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "inventory_stock_movements_product_id_idx" ON "inventory_stock_movements" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "inventory_stock_movements_variant_id_idx" ON "inventory_stock_movements" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "inventory_stock_movements_stock_item_key_idx" ON "inventory_stock_movements" USING btree ("stock_item_key");--> statement-breakpoint
CREATE INDEX "inventory_stock_movements_movement_type_idx" ON "inventory_stock_movements" USING btree ("movement_type");--> statement-breakpoint
CREATE INDEX "inventory_stock_movements_reference_type_reference_id_idx" ON "inventory_stock_movements" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "inventory_stock_movements_created_at_idx" ON "inventory_stock_movements" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_stock_transfers_business_id_transfer_no_unique" ON "inventory_stock_transfers" USING btree ("business_id","transfer_no") WHERE "inventory_stock_transfers"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "inventory_stock_transfers_business_id_idx" ON "inventory_stock_transfers" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "inventory_stock_transfers_from_warehouse_id_idx" ON "inventory_stock_transfers" USING btree ("from_warehouse_id");--> statement-breakpoint
CREATE INDEX "inventory_stock_transfers_to_warehouse_id_idx" ON "inventory_stock_transfers" USING btree ("to_warehouse_id");--> statement-breakpoint
CREATE INDEX "inventory_stock_transfers_status_idx" ON "inventory_stock_transfers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "inventory_stock_transfer_items_transfer_id_idx" ON "inventory_stock_transfer_items" USING btree ("transfer_id");--> statement-breakpoint
CREATE INDEX "inventory_stock_transfer_items_product_id_idx" ON "inventory_stock_transfer_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "inventory_stock_transfer_items_variant_id_idx" ON "inventory_stock_transfer_items" USING btree ("variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_wh_stock_by_stock_unique" ON "inventory_warehouse_stocks" USING btree ("business_id","warehouse_id","stock_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_wh_stock_by_item_unique" ON "inventory_warehouse_stocks" USING btree ("business_id","warehouse_id","stock_item_key");--> statement-breakpoint
CREATE INDEX "inventory_warehouse_stocks_business_id_idx" ON "inventory_warehouse_stocks" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "inventory_warehouse_stocks_stock_id_idx" ON "inventory_warehouse_stocks" USING btree ("stock_id");--> statement-breakpoint
CREATE INDEX "inventory_warehouse_stocks_warehouse_id_idx" ON "inventory_warehouse_stocks" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "inventory_warehouse_stocks_product_id_idx" ON "inventory_warehouse_stocks" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "inventory_warehouse_stocks_variant_id_idx" ON "inventory_warehouse_stocks" USING btree ("variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_invoices_business_id_invoice_no_active_unique" ON "invoices" USING btree ("business_id","invoice_no") WHERE "invoices"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "invoice_invoices_business_id_idx" ON "invoices" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "invoice_invoices_order_id_idx" ON "invoices" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "invoice_invoices_customer_id_idx" ON "invoices" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "invoice_invoices_tax_id_idx" ON "invoices" USING btree ("tax_id");--> statement-breakpoint
CREATE INDEX "invoice_invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoice_invoices_invoice_date_idx" ON "invoices" USING btree ("invoice_date");--> statement-breakpoint
CREATE INDEX "invoice_invoices_due_date_idx" ON "invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_items_order_item_id_idx" ON "invoice_items" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "invoice_items_product_id_idx" ON "invoice_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "invoice_items_variant_id_idx" ON "invoice_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "invoice_items_tax_id_idx" ON "invoice_items" USING btree ("tax_id");--> statement-breakpoint
CREATE INDEX "media_assets_business_id_idx" ON "media_assets" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "media_assets_uploaded_by_idx" ON "media_assets" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "media_assets_file_type_idx" ON "media_assets" USING btree ("file_type");--> statement-breakpoint
CREATE INDEX "media_assets_status_idx" ON "media_assets" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "media_asset_tags_media_asset_id_tag_id_unique" ON "media_asset_tags" USING btree ("media_asset_id","tag_id");--> statement-breakpoint
CREATE INDEX "media_asset_tags_media_asset_id_idx" ON "media_asset_tags" USING btree ("media_asset_id");--> statement-breakpoint
CREATE INDEX "media_asset_tags_tag_id_idx" ON "media_asset_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_tags_business_id_name_unique" ON "media_tags" USING btree ("business_id","name") WHERE "media_tags"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "media_tags_business_id_idx" ON "media_tags" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "media_tags_status_idx" ON "media_tags" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_business_id_order_no_active_unique" ON "orders" USING btree ("business_id","order_no") WHERE "orders"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "orders_business_id_idx" ON "orders" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "orders_customer_id_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_warehouse_id_idx" ON "orders" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "orders_tax_id_idx" ON "orders" USING btree ("tax_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_payment_status_idx" ON "orders" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "order_carts_business_id_idx" ON "order_carts" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "order_carts_customer_id_idx" ON "order_carts" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "order_carts_session_id_idx" ON "order_carts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "order_carts_status_idx" ON "order_carts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "order_carts_active_customer_unique" ON "order_carts" USING btree ("business_id","customer_id") WHERE "order_carts"."customer_id" IS NOT NULL AND "order_carts"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "order_cart_items_cart_id_idx" ON "order_cart_items" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX "order_cart_items_product_id_idx" ON "order_cart_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "order_cart_items_variant_id_idx" ON "order_cart_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "order_discounts_order_id_idx" ON "order_discounts" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_discounts_code_idx" ON "order_discounts" USING btree ("code");--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_id_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "order_items_variant_id_idx" ON "order_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "order_items_tax_id_idx" ON "order_items" USING btree ("tax_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_payments_business_id_payment_no_unique" ON "order_payments" USING btree ("business_id","payment_no");--> statement-breakpoint
CREATE INDEX "order_payments_business_id_idx" ON "order_payments" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "order_payments_order_id_idx" ON "order_payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_payments_finance_account_id_idx" ON "order_payments" USING btree ("finance_account_id");--> statement-breakpoint
CREATE INDEX "order_payments_gateway_id_idx" ON "order_payments" USING btree ("gateway_id");--> statement-breakpoint
CREATE INDEX "order_payments_gateway_config_id_idx" ON "order_payments" USING btree ("gateway_config_id");--> statement-breakpoint
CREATE INDEX "order_payments_payment_method_idx" ON "order_payments" USING btree ("payment_method");--> statement-breakpoint
CREATE INDEX "order_payments_payment_status_idx" ON "order_payments" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "order_payments_gateway_session_id_idx" ON "order_payments" USING btree ("gateway_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_payments_business_id_gateway_transaction_unique" ON "order_payments" USING btree ("business_id","gateway_transaction_id") WHERE "order_payments"."gateway_transaction_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "order_payments_business_id_gateway_event_unique" ON "order_payments" USING btree ("business_id","gateway_event_id") WHERE "order_payments"."gateway_event_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "order_payments_paid_at_idx" ON "order_payments" USING btree ("paid_at");--> statement-breakpoint
CREATE UNIQUE INDEX "order_returns_business_id_return_no_active_unique" ON "order_returns" USING btree ("business_id","return_no") WHERE "order_returns"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "order_returns_business_id_idx" ON "order_returns" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "order_returns_order_id_idx" ON "order_returns" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_returns_status_idx" ON "order_returns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "order_return_items_return_id_idx" ON "order_return_items" USING btree ("return_id");--> statement-breakpoint
CREATE INDEX "order_return_items_order_item_id_idx" ON "order_return_items" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "order_return_items_product_id_idx" ON "order_return_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "order_return_items_variant_id_idx" ON "order_return_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "order_status_logs_order_id_idx" ON "order_status_logs" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_status_logs_to_status_idx" ON "order_status_logs" USING btree ("to_status");--> statement-breakpoint
CREATE INDEX "order_status_logs_created_at_idx" ON "order_status_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "package_payments_tenant_id_idx" ON "package_payments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "package_payments_subscription_id_idx" ON "package_payments" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "package_payments_plan_id_idx" ON "package_payments" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "package_payments_status_idx" ON "package_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "package_payments_expires_at_idx" ON "package_payments" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "package_plans_name_unique" ON "package_plans" USING btree ("name") WHERE "package_plans"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "package_plans_is_default_idx" ON "package_plans" USING btree ("is_default");--> statement-breakpoint
CREATE INDEX "package_plans_status_idx" ON "package_plans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "package_plan_features_package_id_idx" ON "package_plan_features" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "package_plan_features_package_id_sort_order_idx" ON "package_plan_features" USING btree ("package_id","sort_order");--> statement-breakpoint
CREATE INDEX "package_plan_features_is_active_idx" ON "package_plan_features" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "package_plan_limits_package_id_limit_key_unique" ON "package_plan_limits" USING btree ("package_id","limit_key");--> statement-breakpoint
CREATE INDEX "package_plan_limits_limit_key_idx" ON "package_plan_limits" USING btree ("limit_key");--> statement-breakpoint
CREATE INDEX "package_subscriptions_tenant_id_idx" ON "package_subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "package_subscriptions_package_id_idx" ON "package_subscriptions" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "package_subscriptions_status_idx" ON "package_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "package_subscriptions_current_period_end_idx" ON "package_subscriptions" USING btree ("current_period_end");--> statement-breakpoint
CREATE INDEX "package_tenant_credit_ledger_tenant_id_idx" ON "package_tenant_credit_ledger" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "package_tenant_credit_ledger_subscription_id_idx" ON "package_tenant_credit_ledger" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "package_tenant_credit_ledger_payment_id_idx" ON "package_tenant_credit_ledger" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "package_usage_counters_subscription_id_limit_key_period_start_period_end_unique" ON "package_usage_counters" USING btree ("subscription_id","limit_key","period_start","period_end");--> statement-breakpoint
CREATE INDEX "package_usage_counters_limit_key_idx" ON "package_usage_counters" USING btree ("limit_key");--> statement-breakpoint
CREATE INDEX "package_usage_counters_period_start_period_end_idx" ON "package_usage_counters" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_gateways_code_unique" ON "payment_gateways" USING btree ("code");--> statement-breakpoint
CREATE INDEX "payment_gateways_status_idx" ON "payment_gateways" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_gateway_configs_business_gateway_active_unique" ON "payment_gateway_configs" USING btree ("business_id","gateway_id") WHERE "payment_gateway_configs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "payment_gateway_configs_business_id_idx" ON "payment_gateway_configs" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "payment_gateway_configs_gateway_id_idx" ON "payment_gateway_configs" USING btree ("gateway_id");--> statement-breakpoint
CREATE INDEX "payment_gateway_configs_finance_account_id_idx" ON "payment_gateway_configs" USING btree ("finance_account_id");--> statement-breakpoint
CREATE INDEX "payment_gateway_configs_status_idx" ON "payment_gateway_configs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_webhook_events_business_id_idx" ON "payment_webhook_events" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "payment_webhook_events_gateway_id_idx" ON "payment_webhook_events" USING btree ("gateway_id");--> statement-breakpoint
CREATE INDEX "payment_webhook_events_order_payment_id_idx" ON "payment_webhook_events" USING btree ("order_payment_id");--> statement-breakpoint
CREATE INDEX "payment_webhook_events_event_type_idx" ON "payment_webhook_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "payment_webhook_events_event_id_idx" ON "payment_webhook_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "payment_webhook_events_status_idx" ON "payment_webhook_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_webhook_events_created_at_idx" ON "payment_webhook_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "products_business_id_name_deleted_unique" ON "products" USING btree ("business_id","name") WHERE "products"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "product_products_business_id_sku_active_unique" ON "products" USING btree ("business_id","sku") WHERE "products"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "product_products_business_id_barcode_active_unique" ON "products" USING btree ("business_id","barcode") WHERE "products"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "product_products_business_id_idx" ON "products" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "product_products_category_id_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "product_products_brand_id_idx" ON "products" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "product_products_unit_id_idx" ON "products" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "product_products_tax_id_idx" ON "products" USING btree ("tax_id");--> statement-breakpoint
CREATE INDEX "product_products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_products_deleted_at_idx" ON "products" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_attributes_business_id_name_unique" ON "product_attributes" USING btree ("business_id","name") WHERE "product_attributes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "product_attributes_business_id_idx" ON "product_attributes" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "product_attributes_status_idx" ON "product_attributes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_attributes_deleted_at_idx" ON "product_attributes" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_attribute_values_attribute_id_value_unique" ON "product_attribute_values" USING btree ("attribute_id","value") WHERE "product_attribute_values"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "product_attribute_values_business_id_idx" ON "product_attribute_values" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "product_attribute_values_attribute_id_idx" ON "product_attribute_values" USING btree ("attribute_id");--> statement-breakpoint
CREATE INDEX "product_attribute_values_deleted_at_idx" ON "product_attribute_values" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_brads_business_id_name_deleted_unique" ON "product_brands" USING btree ("business_id","name") WHERE "product_brands"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "product_brands_business_id_idx" ON "product_brands" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "product_brands_status_idx" ON "product_brands" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_brands_deleted_at_idx" ON "product_brands" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_business_id_name_deleted_unique" ON "product_categories" USING btree ("business_id","name") WHERE "product_categories"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "product_categories_business_id_idx" ON "product_categories" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "product_categories_parent_id_idx" ON "product_categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "product_categories_status_idx" ON "product_categories" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_categories_deleted_at_idx" ON "product_categories" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "product_images_business_id_idx" ON "product_images" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "product_images_product_id_idx" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_images_variant_id_idx" ON "product_images" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "product_images_is_thumbnail_idx" ON "product_images" USING btree ("is_thumbnail");--> statement-breakpoint
CREATE INDEX "product_images_deleted_at_idx" ON "product_images" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "product_reviews_business_id_idx" ON "product_reviews" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "product_reviews_product_id_idx" ON "product_reviews" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_reviews_customer_id_idx" ON "product_reviews" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "product_reviews_business_id_customer_id_idx" ON "product_reviews" USING btree ("business_id","customer_id");--> statement-breakpoint
CREATE INDEX "product_reviews_variant_id_idx" ON "product_reviews" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "product_reviews_status_idx" ON "product_reviews" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_reviews_rating_idx" ON "product_reviews" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "product_reviews_deleted_at_idx" ON "product_reviews" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_tags_business_id_name_deleted_unique" ON "product_tags" USING btree ("business_id","name") WHERE "product_tags"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "product_tags_business_id_idx" ON "product_tags" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "product_tags_status_idx" ON "product_tags" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_tags_deleted_at_idx" ON "product_tags" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_tag_map_product_id_tag_id_unique" ON "product_tag_map" USING btree ("product_id","tag_id");--> statement-breakpoint
CREATE INDEX "product_tag_map_tag_id_idx" ON "product_tag_map" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_units_business_id_name_deleted_unique" ON "product_units" USING btree ("business_id","name") WHERE "product_units"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "product_units_business_id_idx" ON "product_units" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "product_units_status_idx" ON "product_units" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_units_deleted_at_idx" ON "product_units" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_business_id_product_id_deleted_unique" ON "product_variants" USING btree ("business_id","product_id","title") WHERE "product_variants"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_business_id_sku_active_unique" ON "product_variants" USING btree ("business_id","sku") WHERE "product_variants"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_business_id_barcode_active_unique" ON "product_variants" USING btree ("business_id","barcode") WHERE "product_variants"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "product_variants_business_id_idx" ON "product_variants" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "product_variants_product_id_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_variants_status_idx" ON "product_variants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_variants_deleted_at_idx" ON "product_variants" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variant_attributes_variant_id_attribute_id_unique" ON "product_variant_attributes" USING btree ("variant_id","attribute_id");--> statement-breakpoint
CREATE INDEX "product_variant_attributes_attribute_id_attribute_value_id_idx" ON "product_variant_attributes" USING btree ("attribute_id","attribute_value_id");--> statement-breakpoint
CREATE INDEX "product_variant_attributes_attribute_value_id_idx" ON "product_variant_attributes" USING btree ("attribute_value_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rbac_roles_business_id_name_unique_idx" ON "rbac_roles" USING btree ("business_id","name") WHERE "rbac_roles"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "rbac_roles_business_id_idx" ON "rbac_roles" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "rbac_roles_status_idx" ON "rbac_roles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rbac_roles_deleted_at_idx" ON "rbac_roles" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rbac_role_permissions_role_id_feature_action_unique" ON "rbac_role_permissions" USING btree ("role_id","feature","action");--> statement-breakpoint
CREATE INDEX "rbac_role_permissions_role_id_idx" ON "rbac_role_permissions" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "rbac_role_permissions_feature_idx" ON "rbac_role_permissions" USING btree ("feature");--> statement-breakpoint
CREATE INDEX "rbac_role_permissions_action_idx" ON "rbac_role_permissions" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "rbac_user_role_map_user_id_role_id_unique" ON "rbac_user_role_map" USING btree ("user_id","role_id");--> statement-breakpoint
CREATE INDEX "rbac_user_role_map_user_id_idx" ON "rbac_user_role_map" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rbac_user_role_map_role_id_idx" ON "rbac_user_role_map" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "rbac_user_role_map_status_idx" ON "rbac_user_role_map" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rbac_user_role_map_expires_at_idx" ON "rbac_user_role_map" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_business_id_name_deleted_at_unique" ON "suppliers" USING btree ("business_id","name") WHERE "suppliers"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "suppliers_business_id_idx" ON "suppliers" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "suppliers_status_idx" ON "suppliers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "suppliers_phone_idx" ON "suppliers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "suppliers_email_idx" ON "suppliers" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_invoices_business_id_invoice_no_active_unique" ON "supplier_invoices" USING btree ("business_id","invoice_no") WHERE "supplier_invoices"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "supplier_invoices_business_id_idx" ON "supplier_invoices" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "supplier_invoices_supplier_id_idx" ON "supplier_invoices" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_invoices_purchase_order_id_idx" ON "supplier_invoices" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "supplier_invoices_tax_id_idx" ON "supplier_invoices" USING btree ("tax_id");--> statement-breakpoint
CREATE INDEX "supplier_invoices_status_idx" ON "supplier_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "supplier_invoices_invoice_date_idx" ON "supplier_invoices" USING btree ("invoice_date");--> statement-breakpoint
CREATE INDEX "supplier_invoices_due_date_idx" ON "supplier_invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "supplier_invoice_items_supplier_invoice_id_idx" ON "supplier_invoice_items" USING btree ("supplier_invoice_id");--> statement-breakpoint
CREATE INDEX "supplier_invoice_items_product_id_idx" ON "supplier_invoice_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "supplier_invoice_items_variant_id_idx" ON "supplier_invoice_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "supplier_invoice_items_tax_id_idx" ON "supplier_invoice_items" USING btree ("tax_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_payments_business_id_payment_no_active_unique" ON "supplier_payments" USING btree ("business_id","payment_no") WHERE "supplier_payments"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "supplier_payments_business_id_idx" ON "supplier_payments" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "supplier_payments_supplier_id_idx" ON "supplier_payments" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_payments_supplier_invoice_id_idx" ON "supplier_payments" USING btree ("supplier_invoice_id");--> statement-breakpoint
CREATE INDEX "supplier_payments_payment_date_idx" ON "supplier_payments" USING btree ("payment_date");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_product_map_business_id_supplier_id_product_id_item_key_unique" ON "supplier_product_map" USING btree ("business_id","supplier_id","product_id","item_key");--> statement-breakpoint
CREATE INDEX "supplier_product_map_business_id_idx" ON "supplier_product_map" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "supplier_product_map_supplier_id_idx" ON "supplier_product_map" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_product_map_product_id_idx" ON "supplier_product_map" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "supplier_product_map_variant_id_idx" ON "supplier_product_map" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "supplier_product_map_status_idx" ON "supplier_product_map" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_purchase_orders_business_id_purchase_order_no_deleted_at_unique" ON "supplier_purchase_orders" USING btree ("business_id","purchase_order_no") WHERE "supplier_purchase_orders"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "supplier_purchase_orders_business_id_idx" ON "supplier_purchase_orders" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "supplier_purchase_orders_supplier_id_idx" ON "supplier_purchase_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_purchase_orders_warehouse_id_idx" ON "supplier_purchase_orders" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "supplier_purchase_orders_tax_id_idx" ON "supplier_purchase_orders" USING btree ("tax_id");--> statement-breakpoint
CREATE INDEX "supplier_purchase_orders_status_idx" ON "supplier_purchase_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "supplier_purchase_orders_order_date_idx" ON "supplier_purchase_orders" USING btree ("order_date");--> statement-breakpoint
CREATE INDEX "supplier_purchase_order_items_purchase_order_id_idx" ON "supplier_purchase_order_items" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "supplier_purchase_order_items_product_id_idx" ON "supplier_purchase_order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "supplier_purchase_order_items_variant_id_idx" ON "supplier_purchase_order_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "supplier_purchase_order_items_tax_id_idx" ON "supplier_purchase_order_items" USING btree ("tax_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_purchase_returns_business_id_return_no_unique" ON "supplier_purchase_returns" USING btree ("business_id","return_no");--> statement-breakpoint
CREATE INDEX "supplier_purchase_returns_business_id_idx" ON "supplier_purchase_returns" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "supplier_purchase_returns_supplier_id_idx" ON "supplier_purchase_returns" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_purchase_returns_purchase_order_id_idx" ON "supplier_purchase_returns" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "supplier_purchase_returns_supplier_invoice_id_idx" ON "supplier_purchase_returns" USING btree ("supplier_invoice_id");--> statement-breakpoint
CREATE INDEX "supplier_purchase_returns_warehouse_id_idx" ON "supplier_purchase_returns" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "supplier_purchase_returns_tax_id_idx" ON "supplier_purchase_returns" USING btree ("tax_id");--> statement-breakpoint
CREATE INDEX "supplier_purchase_returns_status_idx" ON "supplier_purchase_returns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "supplier_purchase_returns_return_date_idx" ON "supplier_purchase_returns" USING btree ("return_date");--> statement-breakpoint
CREATE INDEX "supplier_purchase_return_items_purchase_return_id_idx" ON "supplier_purchase_return_items" USING btree ("purchase_return_id");--> statement-breakpoint
CREATE INDEX "supplier_purchase_return_items_product_id_idx" ON "supplier_purchase_return_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "supplier_purchase_return_items_variant_id_idx" ON "supplier_purchase_return_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "supplier_purchase_return_items_tax_id_idx" ON "supplier_purchase_return_items" USING btree ("tax_id");--> statement-breakpoint
CREATE INDEX "system_audit_logs_user_id_idx" ON "system_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "system_audit_logs_business_id_idx" ON "system_audit_logs" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "system_audit_logs_feature_idx" ON "system_audit_logs" USING btree ("feature");--> statement-breakpoint
CREATE INDEX "system_audit_logs_entity_name_entity_id_idx" ON "system_audit_logs" USING btree ("entity_name","entity_id");--> statement-breakpoint
CREATE INDEX "system_audit_logs_created_at_idx" ON "system_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "system_email_verifications_user_id_idx" ON "system_email_verifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "system_email_verifications_purpose_idx" ON "system_email_verifications" USING btree ("purpose");--> statement-breakpoint
CREATE INDEX "system_email_verifications_expires_at_idx" ON "system_email_verifications" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "system_password_resets_user_id_idx" ON "system_password_resets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "system_password_resets_expires_at_idx" ON "system_password_resets" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "system_sessions_user_id_idx" ON "system_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "system_sessions_expires_at_idx" ON "system_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "system_sessions_revoked_at_idx" ON "system_sessions" USING btree ("revoked_at");--> statement-breakpoint
CREATE INDEX "system_users_type_idx" ON "system_users" USING btree ("type");--> statement-breakpoint
CREATE INDEX "system_users_status_idx" ON "system_users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "system_users_tenant_id_idx" ON "system_users" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "system_users_deleted_at_idx" ON "system_users" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "system_user_profiles_deleted_at_idx" ON "system_user_profiles" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_warehouses_business_id_name_deleted_at_unique" ON "inventory_warehouses" USING btree ("business_id","name") WHERE "inventory_warehouses"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "inventory_warehouses_business_id_idx" ON "inventory_warehouses" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "inventory_warehouses_status_idx" ON "inventory_warehouses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "inventory_warehouses_deleted_at_idx" ON "inventory_warehouses" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "website_websites_business_id_unique" ON "websites" USING btree ("business_id") WHERE "websites"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "website_websites_slug_unique" ON "websites" USING btree ("slug") WHERE "websites"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "website_websites_business_id_idx" ON "websites" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "website_websites_status_idx" ON "websites" USING btree ("status");--> statement-breakpoint
CREATE INDEX "website_configs_website_id_idx" ON "website_configs" USING btree ("website_id");--> statement-breakpoint
CREATE UNIQUE INDEX "website_domains_domain_unique" ON "website_domains" USING btree ("domain") WHERE "website_domains"."domain" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "website_domains_subdomain_unique" ON "website_domains" USING btree ("subdomain") WHERE "website_domains"."subdomain" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "website_domains_one_primary_per_website_unique" ON "website_domains" USING btree ("website_id") WHERE "website_domains"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "website_domains_website_id_idx" ON "website_domains" USING btree ("website_id");--> statement-breakpoint
CREATE INDEX "website_domains_domain_idx" ON "website_domains" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "website_domains_subdomain_idx" ON "website_domains" USING btree ("subdomain");--> statement-breakpoint
CREATE INDEX "website_domains_domain_type_idx" ON "website_domains" USING btree ("domain_type");--> statement-breakpoint
CREATE INDEX "website_domains_is_primary_idx" ON "website_domains" USING btree ("is_primary");--> statement-breakpoint
CREATE INDEX "website_domains_verification_status_idx" ON "website_domains" USING btree ("verification_status");--> statement-breakpoint
CREATE UNIQUE INDEX "website_publish_versions_website_id_version_no_unique" ON "website_publish_versions" USING btree ("website_id","version_no");--> statement-breakpoint
CREATE INDEX "website_publish_versions_website_id_idx" ON "website_publish_versions" USING btree ("website_id");--> statement-breakpoint
CREATE INDEX "website_publish_versions_published_at_idx" ON "website_publish_versions" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "website_seo_settings_website_id_idx" ON "website_seo_settings" USING btree ("website_id");--> statement-breakpoint
CREATE INDEX "website_theme_settings_website_id_idx" ON "website_theme_settings" USING btree ("website_id");