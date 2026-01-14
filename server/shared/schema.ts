import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const designs = pgTable("designs", {
  id: serial("id").primaryKey(),
  slogan: text("slogan"),
  color: text("color").notNull(),
  textSize: integer("text_size").notNull().default(24),
  textRotation: integer("text_rotation").notNull().default(0),
  textPosition: jsonb("text_position").notNull().default({ x: 150, y: 135 }),
  image: text("image"), // base64 string
  imageScale: integer("image_scale").notNull().default(100),
  imageRotation: integer("image_rotation").notNull().default(0),
  imagePosition: jsonb("image_position").notNull().default({ x: 150, y: 150 }),
  product: text("product").notNull().default("T-shirt"),
  template: text("template").notNull().default("tshirt"),
  templateColor: text("template_color").notNull().default("#ffffff"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDesignSchema = createInsertSchema(designs).pick({
  slogan: true,
  color: true,
  textSize: true,
  textRotation: true,
  textPosition: true,
  image: true,
  imageScale: true,
  imageRotation: true,
  imagePosition: true,
}).extend({
  product: z.string().default("T-shirt"),
  textPosition: z.object({ x: z.number(), y: z.number() }).default({ x: 150, y: 135 }),
  imagePosition: z.object({ x: z.number(), y: z.number() }).default({ x: 150, y: 150 }),
  template: z.string().default('tshirt'),
  templateColor: z.string().default('#ffffff'),
});


export type Design = typeof designs.$inferSelect;
export type InsertDesign = z.infer<typeof insertDesignSchema>;