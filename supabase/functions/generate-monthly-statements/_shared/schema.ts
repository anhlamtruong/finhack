import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "npm:drizzle-orm/pg-core";

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  plaidId: text("plaid_id"),
  name: text("name").notNull(),
  userId: text("user_id").notNull(),
  userEmail: text("user_email"),
});

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  plaidId: text("plaid_id"),
  name: text("name").notNull(),
  userId: text("user_id").notNull(),
  monthlyBudget: integer("monthly_budget").notNull().default(0),
  goalType: text("goal_type").notNull().default("expense"),
});

export const transactions = pgTable("transactions", {
  id: text("id").primaryKey(),
  amount: integer("amount").notNull(),
  payee: text("payee").notNull(),
  notes: text("notes"),
  date: timestamp("date", { mode: "date" }).notNull(),
  accountId: text("account_id").notNull(),
  categoryId: text("category_id"),
});

export const monthlyReports = pgTable("monthly_reports", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  month: text("month").notNull(),
  totalBudget: integer("total_budget").notNull(),
  totalSpent: integer("total_spent").notNull(),
  categoryBreakdown: jsonb("category_breakdown").notNull(),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
});
