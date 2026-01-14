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
  // store designs next to the server code so the path works
  // even if the process cwd is elsewhere
  private filePath = path.join(__dirname, "designs.json");

  private async readData(): Promise<Design[]> {
    try {
      const data = await fs.readFile(this.filePath, "utf-8");
      try {
        const parsed = JSON.parse(data);
        // Reconstruct Date objects
        return parsed.map((d: any) => ({
          ...d,
          createdAt: new Date(d.createdAt)
        }));
      } catch (parseErr) {
        // Corrupted JSON file — back it up and start with a fresh empty store.
        const corruptPath = `${this.filePath}.corrupt-${Date.now()}`;
        console.error('Storage: corrupted JSON detected, backing up to', corruptPath);
        await fs.rename(this.filePath, corruptPath);
        await fs.writeFile(this.filePath, '[]');
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
    // Write to temp file then rename to ensure atomic update
    await fs.writeFile(tmpPath, JSON.stringify(designs, null, 2));
    await fs.rename(tmpPath, this.filePath);
  }

  async createDesign(insertDesign: InsertDesign): Promise<Design> {
    const designs = await this.readData();
    const newDesign: Design = {
      ...insertDesign,
      product: (insertDesign as any).product || "T-shirt",
      template: (insertDesign as any).template || 'tshirt',
      templateColor: (insertDesign as any).templateColor || '#ffffff',
      id: designs.length + 1,
      createdAt: new Date(),
    } as Design;
    designs.push(newDesign);
    await this.writeData(designs);
    return newDesign;
  }

  async getDesigns(limit?: number): Promise<Design[]> {
    const designs = await this.readData();
    if (typeof limit === 'number') return designs.slice(0, limit);
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
    const updated = {
      ...designs[idx],
      ...changes,
    } as Design;
    designs[idx] = updated;
    await this.writeData(designs);
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

// choose storage implementation based on DB environment
let storageImpl: any;
try {
  const { dbStorage } = await import("./storage-db");
  // Accept either a full DATABASE_URL or DB_* components
  const dbConfigured = !!(
    process.env.DATABASE_URL || process.env.DB_NAME || process.env.DB_USER || process.env.DB_PASSWORD
  );

  if (dbConfigured) {
    storageImpl = dbStorage;
    console.log('Using Postgres-backed storage');
  }
} catch (e) {
  // ignore if DB storage is not available
}

let storageType: 'db' | 'json' = 'json';
if (!storageImpl) {
  storageImpl = new JsonStorage();
  storageType = 'json';
  console.log('Using JSON file storage');
} else {
  storageType = 'db';
  console.log('Using Postgres-backed storage');
}

export const storage = storageImpl;
export function getStorageType() {
  return storageType;
}
