ALTER TABLE "categories" ADD COLUMN "monthly_budget" integer;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "goal_type" text DEFAULT 'expense';