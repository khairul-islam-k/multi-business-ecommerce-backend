ALTER TYPE "public"."PackagePaymentStatus" ADD VALUE 'FAILED';--> statement-breakpoint
CREATE TABLE "package_payment_gateway_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gateway_id" uuid NOT NULL,
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
CREATE TABLE "package_payment_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gateway_id" uuid NOT NULL,
	"package_payment_id" uuid,
	"event_type" varchar(100) NOT NULL,
	"event_id" varchar(150),
	"payload" jsonb NOT NULL,
	"status" "PaymentWebhookStatus" NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "package_payments" ADD COLUMN "payment_no" varchar(100);--> statement-breakpoint
ALTER TABLE "package_payments" ADD COLUMN "gateway_config_id" uuid;--> statement-breakpoint
ALTER TABLE "package_payments" ADD COLUMN "gateway_session_id" varchar(255);--> statement-breakpoint
ALTER TABLE "package_payments" ADD COLUMN "gateway_transaction_id" varchar(255);--> statement-breakpoint
ALTER TABLE "package_payments" ADD COLUMN "gateway_event_id" varchar(255);--> statement-breakpoint
ALTER TABLE "package_payments" ADD COLUMN "gateway_payload" jsonb;--> statement-breakpoint
ALTER TABLE "package_payments" ADD COLUMN "failed_at" timestamp;--> statement-breakpoint
ALTER TABLE "package_payments" ADD COLUMN "failure_reason" text;--> statement-breakpoint
ALTER TABLE "package_payment_gateway_configs" ADD CONSTRAINT "package_payment_gateway_configs_gateway_id_payment_gateways_id_fk" FOREIGN KEY ("gateway_id") REFERENCES "public"."payment_gateways"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_payment_gateway_configs" ADD CONSTRAINT "package_payment_gateway_configs_created_by_system_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_payment_gateway_configs" ADD CONSTRAINT "package_payment_gateway_configs_updated_by_system_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_payment_gateway_configs" ADD CONSTRAINT "package_payment_gateway_configs_deleted_by_system_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."system_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_payment_webhook_events" ADD CONSTRAINT "package_payment_webhook_events_gateway_id_payment_gateways_id_fk" FOREIGN KEY ("gateway_id") REFERENCES "public"."payment_gateways"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_payment_webhook_events" ADD CONSTRAINT "package_payment_webhook_events_package_payment_id_package_payments_id_fk" FOREIGN KEY ("package_payment_id") REFERENCES "public"."package_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "package_payment_gateway_configs_gateway_active_unique" ON "package_payment_gateway_configs" USING btree ("gateway_id") WHERE "package_payment_gateway_configs"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "package_payment_gateway_configs_gateway_id_idx" ON "package_payment_gateway_configs" USING btree ("gateway_id");--> statement-breakpoint
CREATE INDEX "package_payment_gateway_configs_status_idx" ON "package_payment_gateway_configs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "package_payment_webhook_events_gateway_id_idx" ON "package_payment_webhook_events" USING btree ("gateway_id");--> statement-breakpoint
CREATE INDEX "package_payment_webhook_events_payment_id_idx" ON "package_payment_webhook_events" USING btree ("package_payment_id");--> statement-breakpoint
CREATE INDEX "package_payment_webhook_events_event_type_idx" ON "package_payment_webhook_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "package_payment_webhook_events_event_id_idx" ON "package_payment_webhook_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "package_payment_webhook_events_status_idx" ON "package_payment_webhook_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "package_payment_webhook_events_created_at_idx" ON "package_payment_webhook_events" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "package_payments" ADD CONSTRAINT "package_payments_gateway_config_id_package_payment_gateway_configs_id_fk" FOREIGN KEY ("gateway_config_id") REFERENCES "public"."package_payment_gateway_configs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "package_payments_payment_no_unique" ON "package_payments" USING btree ("payment_no") WHERE "package_payments"."payment_no" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "package_payments_gateway_config_id_idx" ON "package_payments" USING btree ("gateway_config_id");--> statement-breakpoint
CREATE INDEX "package_payments_gateway_session_id_idx" ON "package_payments" USING btree ("gateway_session_id");--> statement-breakpoint
CREATE INDEX "package_payments_gateway_transaction_id_idx" ON "package_payments" USING btree ("gateway_transaction_id");--> statement-breakpoint
CREATE INDEX "package_payments_gateway_event_id_idx" ON "package_payments" USING btree ("gateway_event_id");