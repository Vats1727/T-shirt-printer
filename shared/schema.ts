import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const designs = pgTable("designs", {
  id: serial("id").primaryKey(),
  slogan: text("slogan"),
  color: text("color").notNull(),
  textSize: integer("text_size").notNull().default(24),
  textPosition: jsonb("text_position").notNull().default({ x: 150, y: 135 }),
  image: text("image"), // base64 string
  imageScale: integer("image_scale").notNull().default(100),
  imagePosition: jsonb("image_position").notNull().default({ x: 150, y: 150 }),
  product: text("product").notNull().default("T-shirt"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDesignSchema = createInsertSchema(designs).pick({
  slogan: true,
  color: true,
  textSize: true,
  textPosition: true,
  image: true,
  imageScale: true,
  imagePosition: true,
}).extend({
  product: z.string().default("T-shirt"),
});

export type Design = typeof designs.$inferSelect;
export type InsertDesign = z.infer<typeof insertDesignSchema>;
