import { z } from 'zod';
import { insertDesignSchema, designs } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  designs: {
    create: {
      method: 'POST' as const,
      path: '/api/designs',
      input: insertDesignSchema,
      responses: {
        201: z.custom<typeof designs.$inferSelect>(),
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/designs',
      responses: {
        200: z.array(z.custom<typeof designs.$inferSelect>()),
      },
    },
  },
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/auth/register',
      input: z.object({ name: z.string().optional(), email: z.string().email(), password: z.string().min(6), role: z.enum(['admin','supplier']) }),
      responses: {
        201: z.object({ id: z.number(), name: z.string().optional(), email: z.string(), role: z.string(), createdAt: z.string().optional() }),
        400: errorSchemas.validation
      }
    },
    login: {
      method: 'POST' as const,
      path: '/api/auth/login',
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
      list: { method: 'GET' as const, path: '/api/admin/colors', responses: { 200: z.array(z.object({ id: z.number(), name: z.string(), hex: z.string() })) } },
      create: { method: 'POST' as const, path: '/api/admin/colors', input: z.object({ name: z.string(), hex: z.string() }), responses: { 201: z.object({ id: z.number(), name: z.string(), hex: z.string() }), 400: errorSchemas.validation } }
    },
    sizes: {
      list: { method: 'GET' as const, path: '/api/admin/sizes', responses: { 200: z.array(z.object({ id: z.number(), label: z.string() })) } },
      create: { method: 'POST' as const, path: '/api/admin/sizes', input: z.object({ label: z.string() }), responses: { 201: z.object({ id: z.number(), label: z.string() }), 400: errorSchemas.validation } }
    },
    inventory: {
      upsert: { method: 'POST' as const, path: '/api/admin/inventory', input: z.object({ color_id: z.number(), size_id: z.number(), quantity: z.number(), price: z.number() }), responses: { 200: z.object({ id: z.number(), color_id: z.number(), size_id: z.number(), quantity: z.number(), price: z.number() }) } }
    }
  },
  supplier: {
    catalog: { method: 'GET' as const, path: '/api/supplier/catalog', responses: { 200: z.object({ colors: z.array(z.object({ id: z.number(), name: z.string(), hex: z.string() })), sizes: z.array(z.object({ id: z.number(), label: z.string() })), inventory: z.array(z.object({ id: z.number(), color_id: z.number(), size_id: z.number(), quantity: z.number(), price: z.number() })) }) } },
    order: { method: 'POST' as const, path: '/api/supplier/order', input: z.object({ items: z.array(z.object({ color_id: z.number(), size_id: z.number(), quantity: z.number(), price: z.number() })) }), responses: { 201: z.object({ id: z.number() }), 400: errorSchemas.validation } }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
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

export type DesignInput = z.infer<typeof api.designs.create.input>;
export type DesignResponse = z.infer<typeof api.designs.create.responses[201]>;
export type DesignsListResponse = z.infer<typeof api.designs.list.responses[200]>;