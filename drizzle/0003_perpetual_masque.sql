CREATE TYPE "public"."CourierAreaType" AS ENUM('DIVISION', 'DISTRICT', 'UPAZILA', 'UNION');--> statement-breakpoint
CREATE TABLE "courier_area_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(50) NOT NULL,
	"external_id" varchar(80) NOT NULL,
	"area_type" "CourierAreaType" NOT NULL,
	"name" varchar(150) NOT NULL,
	"bn_name" varchar(150),
	"division_name" varchar(150),
	"district_name" varchar(150),
	"upazila_name" varchar(150),
	"parent_external_id" varchar(80),
	"raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "courier_delivery_zone_areas" ADD COLUMN "catalog_area_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "courier_area_catalog_source_type_external_id_unique" ON "courier_area_catalog" USING btree ("source","area_type","external_id");--> statement-breakpoint
CREATE INDEX "courier_area_catalog_source_idx" ON "courier_area_catalog" USING btree ("source");--> statement-breakpoint
CREATE INDEX "courier_area_catalog_area_type_idx" ON "courier_area_catalog" USING btree ("area_type");--> statement-breakpoint
CREATE INDEX "courier_area_catalog_name_idx" ON "courier_area_catalog" USING btree ("name");--> statement-breakpoint
CREATE INDEX "courier_area_catalog_division_name_idx" ON "courier_area_catalog" USING btree ("division_name");--> statement-breakpoint
CREATE INDEX "courier_area_catalog_district_name_idx" ON "courier_area_catalog" USING btree ("district_name");--> statement-breakpoint
CREATE INDEX "courier_area_catalog_upazila_name_idx" ON "courier_area_catalog" USING btree ("upazila_name");--> statement-breakpoint
ALTER TABLE "courier_delivery_zone_areas" ADD CONSTRAINT "courier_delivery_zone_areas_catalog_area_id_courier_area_catalog_id_fk" FOREIGN KEY ("catalog_area_id") REFERENCES "public"."courier_area_catalog"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "courier_delivery_zone_areas_zone_catalog_area_unique" ON "courier_delivery_zone_areas" USING btree ("delivery_zone_id","catalog_area_id");--> statement-breakpoint
CREATE INDEX "courier_delivery_zone_areas_catalog_area_id_idx" ON "courier_delivery_zone_areas" USING btree ("catalog_area_id");