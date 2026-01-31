import { integer, pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  plaidId: text("plaid_id"),
  name: text("name").notNull(),
  userId: text("user_id").notNull(),
  monthlyBudget: integer("monthly_budget").notNull().default(0),
  goalType: text("goal_type").notNull().default("expense"), // 'saving' vs 'expense' (To handle the Red/Green logic)
});

export const insertCategoriesSchema = createInsertSchema(categories);
export const selectCategoriesSchema = createSelectSchema(categories);
