import { type Design, type InsertDesign } from "@shared/schema";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

export interface IStorage {
  createDesign(design: InsertDesign): Promise<Design>;
  getDesigns(limit?: number): Promise<Design[]>;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class JsonStorage implements IStorage {
  private filePath = path.join(__dirname, "../../designs.json");

  private async readData(): Promise<Design[]> {
    try {
      const data = await fs.readFile(this.filePath, "utf-8");
      try {
        const parsed = JSON.parse(data);
        return parsed.map((d: any) => ({ ...d, createdAt: new Date(d.createdAt) }));
      } catch (parseErr) {
        const corruptPath = `${this.filePath}.corrupt-${Date.now()}`;
        console.error("Storage: corrupted JSON detected, backing up to", corruptPath);
        await fs.rename(this.filePath, corruptPath);
        await fs.writeFile(this.filePath, "[]");
        return [];
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  private async writeData(designs: Design[]) {
    const tmpPath = `${this.filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(designs, null, 2));
    await fs.rename(tmpPath, this.filePath);
  }

  async createDesign(insertDesign: InsertDesign): Promise<Design> {
    const designs = await this.readData();
    const newDesign: Design = {
      ...insertDesign,
      product: (insertDesign as any).product || "T-shirt",
      template: (insertDesign as any).template || "tshirt",
      templateColor: (insertDesign as any).templateColor || "#ffffff",
      id: designs.length + 1,
      createdAt: new Date(),
    } as Design;
    designs.push(newDesign);
    await this.writeData(designs);

    // generate masks for any images (optional)
    try {
      const { generateMaskFromBase64 } = await import('./maskGenerator');
      let updated = false;
      if (newDesign.image && typeof newDesign.image === 'string' && newDesign.image.startsWith('data:')) {
        const r = await generateMaskFromBase64(newDesign.image, `design-${newDesign.id}-front`);
        if (r) {
          if (r.composite) newDesign.image = r.composite;
          (newDesign as any).image_mask = r.mask;
          updated = true;
        }
      }
      if ((newDesign as any).back_image && typeof (newDesign as any).back_image === 'string' && (newDesign as any).back_image.startsWith('data:')) {
        const r = await generateMaskFromBase64((newDesign as any).back_image, `design-${newDesign.id}-back`);
        if (r) {
          if (r.composite) (newDesign as any).back_image = r.composite;
          (newDesign as any).back_image_mask = r.mask;
          updated = true;
        }
      }
      if (updated) {
        // persist changes
        const idx = designs.findIndex(d => d.id === newDesign.id);
        if (idx !== -1) {
          designs[idx] = newDesign;
          await this.writeData(designs);
        }
      }
    } catch (e) {
      // ignore
    }

    return newDesign;
  }

  async getDesigns(limit?: number): Promise<Design[]> {
    const designs = await this.readData();
    if (typeof limit === "number") return designs.slice(0, limit);
    return designs;
  }

  async getDesign(id: number): Promise<Design | undefined> {
    const designs = await this.readData();
    return designs.find((d) => d.id === id);
  }

  async updateDesign(id: number, changes: Partial<InsertDesign>): Promise<Design | undefined> {
    const designs = await this.readData();
    const idx = designs.findIndex((d) => d.id === id);
    if (idx === -1) return undefined;
    const updated = { ...designs[idx], ...changes } as Design;
    designs[idx] = updated;
    await this.writeData(designs);

    // generate masks if image changed
    try {
      const { generateMaskFromBase64 } = await import('./maskGenerator');
      let changed = false;

      if (changes.image && typeof changes.image === 'string' && changes.image.startsWith('data:')) {
        const r = await generateMaskFromBase64(changes.image, `design-${id}-front`);
        if (r) {
          if (r.composite) updated.image = r.composite as any;
          (updated as any).image_mask = r.mask;
          changed = true;
        }
      }

      if ((changes as any).back_image && typeof (changes as any).back_image === 'string' && (changes as any).back_image.startsWith('data:')) {
        const r = await generateMaskFromBase64((changes as any).back_image, `design-${id}-back`);
        if (r) {
          if (r.composite) (updated as any).back_image = r.composite as any;
          (updated as any).back_image_mask = r.mask;
          changed = true;
        }
      }

      if (changed) {
        designs[idx] = updated;
        await this.writeData(designs);
      }
    } catch (e) {
      // ignore
    }

    return updated;
  }

  async deleteDesign(id: number): Promise<boolean> {
    const designs = await this.readData();
    const idx = designs.findIndex((d) => d.id === id);
    if (idx === -1) return false;
    designs.splice(idx, 1);
    await this.writeData(designs);
    return true;
  }
}

// Try DB implementation if available
let storageImpl: any;
let storageType: 'db' | 'json' = 'json';
try {
  const { dbStorage } = await import("../services/storage-db");
  const dbConfigured = !!(
    process.env.DATABASE_URL || process.env.DB_NAME || process.env.DB_USER || process.env.DB_PASSWORD
  );

  if (dbConfigured) {
    storageImpl = dbStorage;
    storageType = 'db';
    console.log('Using Postgres-backed storage');
  }
} catch (e) {
  // ignore
}

if (!storageImpl) {
  storageImpl = new JsonStorage();
  storageType = 'json';
  console.log('Using JSON file storage');
}

export const storage = storageImpl;
export function getStorageType() {
  return storageType;
}
