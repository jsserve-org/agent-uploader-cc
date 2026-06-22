ALTER TABLE "upload" ADD COLUMN "is_apk" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "upload" ADD COLUMN "app_package" text;--> statement-breakpoint
ALTER TABLE "upload" ADD COLUMN "app_label" text;--> statement-breakpoint
ALTER TABLE "upload" ADD COLUMN "app_version_name" text;--> statement-breakpoint
ALTER TABLE "upload" ADD COLUMN "app_version_code" bigint;--> statement-breakpoint
ALTER TABLE "upload" ADD COLUMN "app_icon" text;