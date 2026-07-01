DROP INDEX "package_plan_features_package_id_sort_order_idx";--> statement-breakpoint
ALTER TABLE "courier_configs" ALTER COLUMN "config_data" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "couriers" DROP COLUMN "sort_order";--> statement-breakpoint
ALTER TABLE "courier_delivery_zones" DROP COLUMN "sort_order";--> statement-breakpoint
ALTER TABLE "package_plans" DROP COLUMN "sort_order";--> statement-breakpoint
ALTER TABLE "package_plan_features" DROP COLUMN "sort_order";--> statement-breakpoint
ALTER TABLE "payment_gateways" DROP COLUMN "sort_order";--> statement-breakpoint
ALTER TABLE "product_brands" DROP COLUMN "sort_order";--> statement-breakpoint
ALTER TABLE "product_categories" DROP COLUMN "sort_order";--> statement-breakpoint
ALTER TABLE "product_images" DROP COLUMN "sort_order";