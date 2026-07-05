DROP INDEX "website_domains_domain_unique";--> statement-breakpoint
DROP INDEX "website_domains_subdomain_unique";--> statement-breakpoint
DROP INDEX "website_domains_one_primary_per_website_unique";--> statement-breakpoint
ALTER TABLE "website_domains" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "website_domains" ALTER COLUMN "created_at" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "website_domains_domain_unique" ON "website_domains" USING btree ("domain") WHERE "website_domains"."domain" IS NOT NULL AND "website_domains"."created_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "website_domains_subdomain_unique" ON "website_domains" USING btree ("subdomain") WHERE "website_domains"."subdomain" IS NOT NULL AND "website_domains"."created_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "website_domains_one_primary_per_website_unique" ON "website_domains" USING btree ("website_id") WHERE "website_domains"."is_primary" = true AND "website_domains"."created_at" IS NULL;--> statement-breakpoint
ALTER TABLE "website_seo_settings" ADD CONSTRAINT "website_seo_settings_website_id_unique" UNIQUE("website_id");