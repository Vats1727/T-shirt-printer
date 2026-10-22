import { z } from "zod";
import { insertDesignV2Schema } from './schema.js';
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional()
  }),
  internal: z.object({
    message: z.string()
  })
};
export const api = {
  designs: {
    create: {
      method: "POST",
      path: "/api/designs",
      input: insertDesignV2Schema,
      responses: {
        201: z.custom(),
        400: errorSchemas.validation,
        500: errorSchemas.internal
      }
    },
    list: {
      method: "GET",
      path: "/api/designs",
      responses: {
        200: z.array(z.custom())
      }
    }
  },
  auth: {
    register: {
      method: "POST",
      path: "/api/auth/register",
      input: z.object({ name: z.string().optional(), email: z.string().email(), password: z.string().min(6), role: z.enum(["print_provider", "designer", "portal_admin"]) }),
      responses: {
        201: z.object({ id: z.number(), name: z.string().optional(), email: z.string(), role: z.string(), createdAt: z.string().optional() }),
        400: errorSchemas.validation
      }
    },
    login: {
      method: "POST",
      path: "/api/auth/login",
      input: z.object({ email: z.string().email(), password: z.string().min(6) }),
      responses: {
        200: z.object({ token: z.string(), user: z.object({ id: z.number(), email: z.string(), name: z.string().optional(), role: z.string() }) }),
        400: errorSchemas.validation,
        401: errorSchemas.internal
      }
    }
  },
  admin: {
    colors: {
      list: { method: "GET", path: "/api/admin/colors", responses: { 200: z.array(z.object({ id: z.number(), name: z.string(), hex: z.string() })) } },
      create: { method: "POST", path: "/api/admin/colors", input: z.object({ name: z.string(), hex: z.string() }), responses: { 201: z.object({ id: z.number(), name: z.string(), hex: z.string() }), 400: errorSchemas.validation } }
    },
    sizes: {
      list: { method: "GET", path: "/api/admin/sizes", responses: { 200: z.array(z.object({ id: z.number(), label: z.string() })) } },
      create: { method: "POST", path: "/api/admin/sizes", input: z.object({ label: z.string() }), responses: { 201: z.object({ id: z.number(), label: z.string() }), 400: errorSchemas.validation } }
    },
    inventory: {
      upsert: { method: "POST", path: "/api/admin/inventory", input: z.object({ color_id: z.number(), size_id: z.number(), quantity: z.number(), price: z.number() }), responses: { 200: z.object({ id: z.number(), color_id: z.number(), size_id: z.number(), quantity: z.number(), price: z.number() }) } }
    },
    orders: { method: "GET", path: "/api/admin/orders", responses: { 200: z.object({ orders: z.array(z.any()) }) } },
    order: { method: "GET", path: "/api/admin/orders/:id", responses: { 200: z.object({ order: z.any() }), 404: errorSchemas.validation } },
    profile: {
      get: { method: "GET", path: "/api/admin/profile", responses: { 200: z.any() } },
      update: { method: "PATCH", path: "/api/admin/profile", input: z.object({ subscription_tier: z.string() }), responses: { 200: z.object({ ok: z.boolean() }), 400: errorSchemas.validation } }
    }
  },
  portal: {
    providers: {
      list: { method: "GET", path: "/api/portal/providers", responses: { 200: z.array(z.any()) } },
      update: { method: "PATCH", path: "/api/portal/providers/:id", input: z.object({ status: z.string().optional(), subscription_tier: z.string().optional() }), responses: { 200: z.object({ ok: z.boolean() }), 400: errorSchemas.validation } }
    }
  },
  supplier: {
    catalog: { method: "GET", path: "/api/supplier/catalog", responses: { 200: z.object({ colors: z.array(z.object({ id: z.number(), name: z.string(), hex: z.string() })), sizes: z.array(z.object({ id: z.number(), label: z.string() })), inventory: z.array(z.object({ id: z.number(), color_id: z.number(), size_id: z.number(), quantity: z.number(), price: z.number() })) }) } },
    order: { method: "POST", path: "/api/supplier/order", input: z.object({ items: z.array(z.object({ color_id: z.number(), size_id: z.number(), quantity: z.number(), price: z.number(), design_id: z.number().optional(), design_snapshot: z.any().optional() })), shipping: z.object({ customer_name: z.string().optional(), customer_email: z.string().optional(), shipping_address: z.any().optional(), shipping_method: z.string().optional(), shipping_cost_cents: z.number().optional() }).optional() }), responses: { 201: z.object({ id: z.number() }), 400: errorSchemas.validation } },
    ordersList: { method: "GET", path: "/api/supplier/orders", responses: { 200: z.object({ orders: z.array(z.any()) }) } },
    ordersGet: { method: "GET", path: "/api/supplier/orders/:id", responses: { 200: z.object({ order: z.any() }), 404: errorSchemas.validation } }
  }
};
export function buildUrl(path, params) {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
