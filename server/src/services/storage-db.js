import { db } from '../../db.js';
import { designs } from '../shared/schema.js';
import { eq } from "drizzle-orm";
export class DbStorage {
  async createDesign(insertDesign) {
    const [row] = await db.insert(designs).values(insertDesign).returning();
    return row;
  }
  async getDesigns(limit) {
    let q = db.select().from(designs).orderBy(designs.id);
    if (typeof limit === "number") q = q.limit(limit);
    const rows = await q;
    return rows;
  }
  async getDesign(id) {
    const rows = await db.select().from(designs).where(eq(designs.id, id));
    return rows[0];
  }
  async updateDesign(id, changes) {
    const [row] = await db.update(designs).set(changes).where(eq(designs.id, id)).returning();
    return row;
  }
  async deleteDesign(id) {
    const res = await db.delete(designs).where(eq(designs.id, id));
    return (res.rowCount || 0) > 0;
  }
}
export const dbStorage = new DbStorage();
