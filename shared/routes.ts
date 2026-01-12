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
