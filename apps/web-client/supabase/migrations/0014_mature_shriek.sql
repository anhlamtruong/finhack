CREATE TABLE "companion_events" (
	"id" text PRIMARY KEY NOT NULL,
	"companion_id" text NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"xp_delta" integer DEFAULT 0 NOT NULL,
	"hunger_delta" integer DEFAULT 0 NOT NULL,
	"cleanliness_delta" integer DEFAULT 0 NOT NULL,
	"energy_delta" integer DEFAULT 0 NOT NULL,
	"mood" text DEFAULT 'neutral' NOT NULL,
	"payload" jsonb DEFAULT '{"reason":"unknown","xpDelta":0}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companion_memories" (
	"id" text PRIMARY KEY NOT NULL,
	"companion_id" text NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"sentiment" text DEFAULT 'neutral' NOT NULL,
	"importance" integer DEFAULT 1 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text DEFAULT 'Chuchube' NOT NULL,
	"archetype" text DEFAULT 'guardian' NOT NULL,
	"prompt" text,
	"personality" jsonb DEFAULT '{"tone":"supportive","backstory":"","financialFocus":"saving"}'::jsonb NOT NULL,
	"assets" jsonb DEFAULT '{"baby":{"idle":null,"happy":null,"sleepy":null,"hungry":null},"adult":{"idle":null,"happy":null,"sleepy":null,"hungry":null},"mythic":{"idle":null,"happy":null,"sleepy":null,"hungry":null}}'::jsonb NOT NULL,
	"evolution_stage" text DEFAULT 'baby' NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"hunger" integer DEFAULT 0 NOT NULL,
	"cleanliness" integer DEFAULT 100 NOT NULL,
	"energy" integer DEFAULT 100 NOT NULL,
	"mood" text DEFAULT 'neutral' NOT NULL,
	"vitals" jsonb DEFAULT '{"hunger":0,"cleanliness":100,"energy":100,"mood":"neutral","lastDecayAt":null}'::jsonb NOT NULL,
	"data_hygiene" jsonb DEFAULT '{"uncategorized":0}'::jsonb,
	"last_fed_at" timestamp with time zone,
	"last_cleaned_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"last_interacted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companion_events" ADD CONSTRAINT "companion_events_companion_id_companions_id_fk" FOREIGN KEY ("companion_id") REFERENCES "public"."companions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companion_memories" ADD CONSTRAINT "companion_memories_companion_id_companions_id_fk" FOREIGN KEY ("companion_id") REFERENCES "public"."companions"("id") ON DELETE cascade ON UPDATE no action;