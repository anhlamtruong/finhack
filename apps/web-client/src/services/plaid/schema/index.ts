import { pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const connectedBanks = pgTable("connected_banks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  accessToken: text("access_token").notNull(),
});

export const insertConnectedBankSchema = createInsertSchema(connectedBanks);
export const selectConnectedBankSchema = createSelectSchema(connectedBanks);
