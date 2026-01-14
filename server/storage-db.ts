import { db } from "./db";
import { designs } from "./shared/schema";
import type { Design, InsertDesign } from "@shared/schema";
import { eq } from "drizzle-orm";

export class DbStorage {
  async createDesign(insertDesign: InsertDesign): Promise<Design> {
    const [row] = await db.insert(designs).values(insertDesign).returning();
    return row as Design;
  }

  async getDesigns(limit?: number): Promise<Design[]> {
    let q = db.select().from(designs).orderBy(designs.id);
    if (typeof limit === 'number') q = q.limit(limit);
    const rows = await q;
    return rows as Design[];
  }

  async getDesign(id: number): Promise<Design | undefined> {
    const rows = await db.select().from(designs).where(eq(designs.id, id));
    return (rows as Design[])[0];
  }

  async updateDesign(id: number, changes: Partial<InsertDesign>): Promise<Design | undefined> {
    const [row] = await db.update(designs).set(changes).where(eq(designs.id, id)).returning();
    return row as Design | undefined;
  }

  async deleteDesign(id: number): Promise<boolean> {
    const res = await db.delete(designs).where(eq(designs.id, id));
    return (res.rowCount || 0) > 0;
  }
}

export const dbStorage = new DbStorage();