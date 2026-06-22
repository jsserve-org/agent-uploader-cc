CREATE TABLE "download_event" (
	"id" text PRIMARY KEY NOT NULL,
	"upload_id" text NOT NULL,
	"user_id" text NOT NULL,
	"key_id" text,
	"ip_address" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "upload" ADD COLUMN "folder" text;--> statement-breakpoint
ALTER TABLE "upload" ADD COLUMN "max_downloads" integer;--> statement-breakpoint
ALTER TABLE "upload" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "upload" ADD COLUMN "last_download_at" timestamp;--> statement-breakpoint
ALTER TABLE "upload_key" ADD COLUMN "default_folder" text;--> statement-breakpoint
ALTER TABLE "upload_key" ADD COLUMN "allowed_types" text;--> statement-breakpoint
ALTER TABLE "upload_key" ADD COLUMN "max_downloads" integer;--> statement-breakpoint
ALTER TABLE "upload_key" ADD COLUMN "download_password_hash" text;--> statement-breakpoint
ALTER TABLE "upload_key" ADD COLUMN "webhook_url" text;--> statement-breakpoint
ALTER TABLE "download_event" ADD CONSTRAINT "download_event_upload_id_upload_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."upload"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_event" ADD CONSTRAINT "download_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;