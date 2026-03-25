import { pgTable, text, serial, timestamp, integer, jsonb, doublePrecision, boolean } from "drizzle-orm/pg-core";
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
  back_image_mask: text("back_image_mask"),
  image_mask: text("image_mask"),
  product_id: integer("product_id"),
  owner_id: integer("owner_id"),
  group_id: text("group_id"),
  design_code: text("design_code"),
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
  status: text('status').notNull().default('active'),
  subscription_tier: text('subscription_tier').notNull().default('none'),
  subscription_expiry: timestamp('subscription_expiry'),
  associated_provider_id: integer('associated_provider_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at'),
});

export const colors = pgTable("colors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  hex: text("hex").notNull(),
  owner_id: integer("owner_id"),
});

export const sizes = pgTable("sizes", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  owner_id: integer("owner_id"),
});

export const size_chart = pgTable("size_chart", {
  id: serial("id").primaryKey(),
  size_id: integer("size_id").notNull(),
  product: text("product").notNull().default('tshirt'),
  chest: doublePrecision("chest").notNull(),
  length: doublePrecision("length").notNull(),
  shoulder: doublePrecision("shoulder").notNull(),
  owner_id: integer("owner_id"),
});

export const cloth_inventory = pgTable("cloth_inventory", {
  id: serial("id").primaryKey(),
  color_id: integer("color_id").notNull(),
  size_id: integer("size_id").notNull(),
  product: text("product").notNull().default('tshirt'),
  quantity: integer("quantity").notNull().default(0),
  price: doublePrecision("price").notNull().default(0),
  owner_id: integer("owner_id"),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  single_price: doublePrecision("single_price").notNull().default(0),
  bulk_min: integer("bulk_min").notNull().default(100),
  bulk_price: doublePrecision("bulk_price").notNull().default(0),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const product_sizes = pgTable("product_sizes", {
  id: serial("id").primaryKey(),
  product_id: integer("product_id").notNull(),
  size_id: integer("size_id").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const product_colors = pgTable("product_colors", {
  id: serial("id").primaryKey(),
  product_id: integer("product_id").notNull(),
  color_id: integer("color_id").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const products_full = pgTable("products_full", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  single_price: doublePrecision("single_price").notNull().default(0),
  bulk_min: integer("bulk_min").notNull().default(100),
  bulk_price: doublePrecision("bulk_price").notNull().default(0),
  sizes: jsonb("sizes").notNull().default([]),
  colors: jsonb("colors").notNull().default([]),
  size_chart: jsonb("size_chart").notNull().default([]),
  designs: jsonb("designs").notNull().default([]),
  inventory: jsonb("inventory").notNull().default([]),
  is_deleted: boolean("is_deleted").notNull().default(false),
  deleted_at: timestamp("deleted_at"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at"),
  owner_id: integer("owner_id"),
});

export const listings = pgTable("listings", {
  id: serial("id").primaryKey(),
  supplier_id: integer("supplier_id"),
  title: text("title").notNull(),
  slug: text("slug"),
  description: text("description"),
  design_key: text("design_key"),
  visibility: text("visibility").default("public"),
  published: boolean("published").default(false),
  published_at: timestamp("published_at"),
  created_at: timestamp("created_at").defaultNow(),
});

export const listing_versions = pgTable("listing_versions", {
  id: serial("id").primaryKey(),
  listing_id: integer("listing_id"),
  version_name: text("version_name"),
  metadata: jsonb("metadata"),
  created_at: timestamp("created_at").defaultNow(),
});


// Extended tables for new supplier flow
// Note: `designs_full` and `design_assets` were removed because the
// runtime code uses the legacy `designs` table or JSON file storage.
// If you later want to reintroduce richer design persistence, add a
// focused migration and pgTable definitions at that time.

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

export const assets = pgTable('assets', {
  id: serial('id').primaryKey(),
  filename: text('filename'),
  mime: text('mime'),
  size: integer('size'),
  storage_key: text('storage_key'),
  metadata: jsonb('metadata'),
  uploader_id: integer('uploader_id'),
  owner_id: integer('owner_id'),
  created_at: timestamp('created_at').defaultNow(),
});

export const design_versions = pgTable('design_versions', {
  id: serial('id').primaryKey(),
  design_id: integer('design_id'),
  version_name: text('version_name'),
  payload: jsonb('payload').notNull(),
  price_cents: integer('price_cents'),
  currency: text('currency').default('USD'),
  processing_state: text('processing_state').default('pending'),
  created_at: timestamp('created_at').defaultNow(),
});

export type Design = typeof designs.$inferSelect;
export type InsertDesign = z.infer<typeof insertDesignSchema>;
export type UserRow = typeof users.$inferSelect;
export type AssetRow = typeof assets.$inferSelect;
export type DesignVersionRow = typeof design_versions.$inferSelect;

// New richer design insert schema (v2) supporting versions, layers, and assets.
const assetInput = z.object({
  id: z.number().optional(),
  filename: z.string().optional(),
  mime: z.string().optional(),
  dataUrl: z.string().optional(), // optional inlined data URL for upload
  width: z.number().optional(),
  height: z.number().optional(),
});

const position = z.object({ x: z.number(), y: z.number() });

const layer = z.object({
  id: z.string().optional(),
  type: z.enum(['text', 'image']),
  text: z.string().optional(),
  font: z.string().optional(),
  size: z.number().optional(),
  color: z.string().optional(),
  rotation: z.number().optional(),
  position: position.optional(),
  asset: assetInput.optional(),
  scale: z.number().optional(),
});

const side = z.object({
  name: z.enum(['front', 'back']),
  layers: z.array(layer),
});

const designVersion = z.object({
  versionName: z.string().optional(),
  sides: z.array(side),
  metadata: z.record(z.any()).optional(),
});

export const insertDesignV2Schema = z.object({
  product: z.string().default('T-shirt'),
  template: z.string().default('tshirt'),
  templateColor: z.string().default('#ffffff'),
  price_cents: z.number().optional(),
  currency: z.string().default('USD'),
  supplier_id: z.number().optional(),
  version: designVersion,
});

export type InsertDesignV2 = z.infer<typeof insertDesignV2Schema>;