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

// Extended tables for new supplier flow
export const designs_full = pgTable('designs_full', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id'),
  name: text('name'),
  slug: text('slug'),
  side: text('side').default('front'),
  slogan: text('slogan'),
  color: text('color'),
  template: text('template'),
  template_color: text('template_color'),
  template_image_url: text('template_image_url'),
  image_url: text('image_url'),
  image_metadata: jsonb('image_metadata'),
  image_scale: integer('image_scale').default(100),
  image_rotation: integer('image_rotation').default(0),
  image_pos_x: integer('image_pos_x').default(150),
  image_pos_y: integer('image_pos_y').default(150),
  text_size: integer('text_size').default(24),
  text_rotation: integer('text_rotation').default(0),
  text_pos_x: integer('text_pos_x').default(150),
  text_pos_y: integer('text_pos_y').default(135),
  image_tint_color: text('image_tint_color'),
  tint_image: text('tint_image'),
  force_template_fill: text('force_template_fill'),
  background_image_url: text('background_image_url'),
  width: integer('width').default(400),
  height: integer('height').default(400),
  layers: jsonb('layers'),
  thumbnails: jsonb('thumbnails'),
  rendered_url: text('rendered_url'),
  metadata: jsonb('metadata'),
  price_cents: integer('price_cents'),
  currency: text('currency'),
  is_public: text('is_public'),
  is_archived: text('is_archived'),
  version: integer('version'),
  revision_of: integer('revision_of'),
  hash: text('hash'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const design_assets = pgTable('design_assets', {
  id: serial('id').primaryKey(),
  design_id: integer('design_id'),
  type: text('type'),
  url: text('url'),
  filename: text('filename'),
  mime: text('mime'),
  meta: jsonb('meta'),
  created_at: timestamp('created_at').defaultNow()
});

export const supplier_orders = pgTable('supplier_orders', {
  id: serial('id').primaryKey(),
  supplier_id: integer('supplier_id'),
  placed_by: integer('placed_by'),
  customer_name: text('customer_name'),
  customer_email: text('customer_email'),
  shipping_address: jsonb('shipping_address'),
  shipping_method: text('shipping_method'),
  shipping_cost_cents: integer('shipping_cost_cents').default(0),
  subtotal_cents: integer('subtotal_cents').default(0),
  tax_cents: integer('tax_cents').default(0),
  total_cents: integer('total_cents').default(0),
  currency: text('currency').default('USD'),
  status: text('status'),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const supplier_order_lines = pgTable('supplier_order_lines', {
  id: serial('id').primaryKey(),
  order_id: integer('order_id'),  
  design_id: integer('design_id'),
  design_snapshot: jsonb('design_snapshot'),
  product_sku: text('product_sku'),
  size: text('size'),
  color: text('color'),
  quantity: integer('quantity'),
  unit_price_cents: integer('unit_price_cents'),
  line_total_cents: integer('line_total_cents'),
  created_at: timestamp('created_at').defaultNow(),
});

export type Design = typeof designs.$inferSelect;
export type InsertDesign = z.infer<typeof insertDesignSchema>;
export type UserRow = typeof users.$inferSelect;