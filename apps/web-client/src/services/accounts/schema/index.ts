import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  plaidId: text("plaid_id"),
  name: text("name").notNull(),
  userId: text("user_id").notNull(),
  userEmail: text("user_email"),
});

export const walletShares = pgTable("wallet_shares", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  userEmail: text("user_email").notNull(),
  role: text("role").notNull().default("viewer"),
  contributionSplit: integer("contribution_split").notNull().default(0),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAccountSchema = createInsertSchema(accounts);
export const selectAccountSchema = createSelectSchema(accounts);
export const insertWalletShareSchema = createInsertSchema(walletShares);
export const selectWalletShareSchema = createSelectSchema(walletShares);
