import { type User } from "@shared/schema";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const usersFile = path.join(__dirname, "../../users.json");

export interface IUserService {
  getByUsername(username: string): Promise<User | undefined>;
  getById(id: number): Promise<User | undefined>;
  createUser(username: string, role: 'admin'|'supplier'): Promise<User>;
  listUsers(): Promise<User[]>;
}

// JSON fallback implementation
class JsonUsers implements IUserService {
  private async read(): Promise<User[]> {
    try {
      const raw = await fs.readFile(usersFile, 'utf-8');
      return JSON.parse(raw);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw e;
    }
  }

  private async write(users: User[]) {
    await fs.writeFile(usersFile, JSON.stringify(users, null, 2));
  }

  async getByUsername(username: string) {
    const users = await this.read();
    return users.find(u => u.username === username);
  }

  async getById(id: number) {
    const users = await this.read();
    return users.find(u => u.id === id);
  }

  async createUser(username: string, role: 'admin'|'supplier') {
    const users = await this.read();
    if (users.find(u => u.username === username)) throw new Error('User exists');
    const user: User = { id: (users[users.length-1]?.id || 0) + 1, username, role, createdAt: new Date() };
    users.push(user);
    await this.write(users);
    return user;
  }

  async listUsers() {
    return await this.read();
  }
}

// Try to use DB-backed implementation if drizzle is available
let impl: IUserService | undefined;
try {
  const mod = await import('../db');
  const { db } = mod as any;
  const { users } = await import('@shared/schema');

  impl = {
    async getByUsername(username: string) {
      const rows = await (db.select().from(users).where(users.username.eq(username)));
      return rows[0] as User | undefined;
    },
    async getById(id: number) {
      const rows = await (db.select().from(users).where(users.id.eq(id)));
      return rows[0] as User | undefined;
    },
    async createUser(username: string, role: 'admin'|'supplier') {
      const [row] = await db.insert(users).values({ username, role }).returning();
      return row as User;
    },
    async listUsers() {
      const rows = await db.select().from(users);
      return rows as User[];
    }
  };
} catch (e) {
  impl = new JsonUsers();
}

export const usersService: IUserService = impl!;