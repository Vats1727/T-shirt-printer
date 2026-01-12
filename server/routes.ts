import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post(api.designs.create.path, async (req, res) => {
    try {
      const input = api.designs.create.input.parse(req.body);
      const design = await storage.createDesign(input);
      res.status(201).json(design);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get(api.designs.list.path, async (req, res) => {
    const designs = await storage.getDesigns();
    res.json(designs);
  });

  return httpServer;
}
