import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

/**
 * Snapshot of companion vitals used for mood + decay.
 */
export type CompanionVitals = {
  hunger: number;
  cleanliness: number;
  energy: number;
  mood?: string;
  lastDecayAt?: string | null;
};

/**
 * Personality traits persisted for LLM prompts.
 */
export type CompanionPersonality = {
  tone: string;
  backstory: string;
  financialFocus?: string;
};

/**
 * Asset URLs for a single evolution stage.
 */
export type CompanionAssetsStage = {
  idle?: string | null;
  happy?: string | null;
  sleepy?: string | null;
  hungry?: string | null;
};

/**
 * Asset bundle for all stages.
 */
export type CompanionAssets = {
  baby: CompanionAssetsStage;
  adult: CompanionAssetsStage;
  mythic: CompanionAssetsStage;
};

/**
 * Metadata attached to stored memories.
 */
export type CompanionMemoryMetadata = {
  event?: string;
  sentiment?: string;
  amountDelta?: number;
  safeToSpend?: number;
};

/**
 * Payload stored alongside companion event logs.
 */
export type CompanionEventPayload = {
  reason: string;
  xpDelta: number;
  notes?: string;
};

/**
 * Default empty assets used for new companions.
 */
const DEFAULT_ASSETS: CompanionAssets = {
  baby: { idle: null, happy: null, sleepy: null, hungry: null },
  adult: { idle: null, happy: null, sleepy: null, hungry: null },
  mythic: { idle: null, happy: null, sleepy: null, hungry: null },
};

/**
 * Default vitals used for new companions.
 */
const DEFAULT_VITALS: CompanionVitals = {
  hunger: 0,
  cleanliness: 100,
  energy: 100,
  mood: "neutral",
  lastDecayAt: null,
};

export const companions = pgTable("companions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull().default("Chuchube"),
  archetype: text("archetype").notNull().default("guardian"),
  prompt: text("prompt"),
  personality: jsonb("personality")
    .$type<CompanionPersonality>()
    .notNull()
    .default({ tone: "supportive", backstory: "", financialFocus: "saving" }),
  assets: jsonb("assets")
    .$type<CompanionAssets>()
    .notNull()
    .default(DEFAULT_ASSETS),
  evolutionStage: text("evolution_stage").notNull().default("baby"),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  hunger: integer("hunger").notNull().default(0),
  cleanliness: integer("cleanliness").notNull().default(100),
  energy: integer("energy").notNull().default(100),
  mood: text("mood").notNull().default("neutral"),
  vitals: jsonb("vitals").$type<CompanionVitals>().notNull().default(
    DEFAULT_VITALS,
  ),
  dataHygiene: jsonb("data_hygiene")
    .$type<{ uncategorized: number; lastRefreshAt?: string | null }>()
    .default({ uncategorized: 0 }),
  lastFedAt: timestamp("last_fed_at", { withTimezone: true }),
  lastCleanedAt: timestamp("last_cleaned_at", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  lastInteractedAt: timestamp("last_interacted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
    .notNull(),
});

export const companionMemories = pgTable("companion_memories", {
  id: text("id").primaryKey(),
  companionId: text("companion_id")
    .notNull()
    .references(() => companions.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  sentiment: text("sentiment").notNull().default("neutral"),
  importance: integer("importance").notNull().default(1),
  metadata: jsonb("metadata")
    .$type<CompanionMemoryMetadata>()
    .notNull()
    .default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
    .notNull(),
});

export const companionEvents = pgTable("companion_events", {
  id: text("id").primaryKey(),
  companionId: text("companion_id")
    .notNull()
    .references(() => companions.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  xpDelta: integer("xp_delta").notNull().default(0),
  hungerDelta: integer("hunger_delta").notNull().default(0),
  cleanlinessDelta: integer("cleanliness_delta").notNull().default(0),
  energyDelta: integer("energy_delta").notNull().default(0),
  mood: text("mood").notNull().default("neutral"),
  payload: jsonb("payload")
    .$type<CompanionEventPayload>()
    .notNull()
    .default({ reason: "unknown", xpDelta: 0 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
    .notNull(),
});

export const insertCompanionSchema = createInsertSchema(companions);
export const selectCompanionSchema = createSelectSchema(companions);
export const insertCompanionMemorySchema = createInsertSchema(
  companionMemories,
);
export const selectCompanionMemorySchema = createSelectSchema(
  companionMemories,
);
export const insertCompanionEventSchema = createInsertSchema(companionEvents);
export const selectCompanionEventSchema = createSelectSchema(companionEvents);
