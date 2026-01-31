import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export type MonthlyReportCategoryBreakdown = {
  categoryId: string;
  categoryName: string;
  goalType?: string;
  budget: number;
  spent: number;
  variance: number;
};

export const monthlyReports = pgTable("monthly_reports", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  month: text("month").notNull(),
  totalBudget: integer("total_budget").notNull(),
  totalSpent: integer("total_spent").notNull(),
  categoryBreakdown: jsonb("category_breakdown")
    .$type<MonthlyReportCategoryBreakdown[]>()
    .notNull(),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
});

export const insertMonthlyReportSchema = createInsertSchema(monthlyReports);
export const selectMonthlyReportSchema = createSelectSchema(monthlyReports);
