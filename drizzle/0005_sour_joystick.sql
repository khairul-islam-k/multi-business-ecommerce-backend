ALTER TABLE "products" ALTER COLUMN "weight" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_carts" ADD COLUMN "weight" numeric(12, 2) DEFAULT 0 NOT NULL;