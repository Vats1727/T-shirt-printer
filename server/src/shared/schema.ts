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
  // Front/back support
  back_slogan: text("back_slogan"),
  back_image: text("back_image"),
  back_image_scale: integer("back_image_scale").notNull().default(100),
  back_image_rotation: integer("back_image_rotation").notNull().default(0),
  back_image_position: jsonb("back_image_position").notNull().default({ x: 150, y: 150 }),
  back_text_size: integer("back_text_size").notNull().default(24),
  back_text_rotation: integer("back_text_rotation").notNull().default(0),
  back_text_position: jsonb("back_text_position").notNull().default({ x: 150, y: 135 }),
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
  // back fields
  back_slogan: true,
  back_image: true,
  back_image_scale: true,
  back_image_rotation: true,
  back_image_position: true,
  back_text_size: true,
  back_text_rotation: true,
  back_text_position: true,
}).extend({
  product: z.string().default("T-shirt"),
  textPosition: z.object({ x: z.number(), y: z.number() }).default({ x: 150, y: 135 }),
  imagePosition: z.object({ x: z.number(), y: z.number() }).default({ x: 150, y: 150 }),
  template: z.string().default('tshirt'),
  templateColor: z.string().default('#ffffff'),
  back_image_position: z.object({ x: z.number(), y: z.number() }).default({ x: 150, y: 150 }),
  back_text_position: z.object({ x: z.number(), y: z.number() }).default({ x: 150, y: 135 }),
});


export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export type Design = typeof designs.$inferSelect;
export type InsertDesign = z.infer<typeof insertDesignSchema>;
export type UserRow = typeof users.$inferSelect;