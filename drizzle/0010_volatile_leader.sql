ALTER TABLE "products" ADD COLUMN "in_offer" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "offer_price" numeric;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "starting_from" timestamp;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "ends_in" timestamp;