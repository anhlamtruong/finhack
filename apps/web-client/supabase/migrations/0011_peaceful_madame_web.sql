CREATE TABLE "monthly_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"month" text NOT NULL,
	"total_budget" integer NOT NULL,
	"total_spent" integer NOT NULL,
	"category_breakdown" jsonb NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
