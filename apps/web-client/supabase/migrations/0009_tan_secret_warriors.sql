ALTER TABLE "accounts" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "user_email" text;