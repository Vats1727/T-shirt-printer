import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const designs = pgTable("designs", {
  id: serial("id").primaryKey(),
  slogan: text("slogan").notNull(),
  product: text("product").notNull().default("T-shirt"),
  color: text("color").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDesignSchema = createInsertSchema(designs).pick({
  slogan: true,
  color: true,
}).extend({
  product: z.string().default("T-shirt"),
});

export type Design = typeof designs.$inferSelect;
export type InsertDesign = z.infer<typeof insertDesignSchema>;
