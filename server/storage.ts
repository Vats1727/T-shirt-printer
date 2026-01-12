import { type Design, type InsertDesign } from "@shared/schema";
import fs from "fs/promises";
import path from "path";

export interface IStorage {
  createDesign(design: InsertDesign): Promise<Design>;
  getDesigns(): Promise<Design[]>;
}

export class JsonStorage implements IStorage {
  private filePath = path.join(process.cwd(), "designs.json");

  private async readData(): Promise<Design[]> {
    try {
      const data = await fs.readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(data);
      // Reconstruct Date objects
      return parsed.map((d: any) => ({
        ...d,
        createdAt: new Date(d.createdAt)
      }));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  private async writeData(designs: Design[]) {
    await fs.writeFile(this.filePath, JSON.stringify(designs, null, 2));
  }

  async createDesign(insertDesign: InsertDesign): Promise<Design> {
    const designs = await this.readData();
    const newDesign: Design = {
      ...insertDesign,
      product: "T-shirt",
      id: designs.length + 1,
      createdAt: new Date(),
    };
    designs.push(newDesign);
    await this.writeData(designs);
    return newDesign;
  }

  async getDesigns(): Promise<Design[]> {
    return this.readData();
  }
}

export const storage = new JsonStorage();
