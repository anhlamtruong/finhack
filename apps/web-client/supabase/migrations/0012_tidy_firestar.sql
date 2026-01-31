CREATE TABLE "wallet_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"user_id" text NOT NULL,
	"user_email" text NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"contribution_split" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "paid_by_user_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "is_settlement" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "wallet_shares" ADD CONSTRAINT "wallet_shares_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;