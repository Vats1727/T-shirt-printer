import { type User } from "@shared/schema";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const usersFile = path.join(__dirname, "../../users.json");

export interface IUserService {
  getByUsername(username: string): Promise<User | undefined>;
  getById(id: number): Promise<User | undefined>;
  createUser(username: string, role: 'admin'|'supplier', password: string): Promise<User>;
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
    return users.find(u => u.username === username) as any;
  }

  async getById(id: number) {
    const users = await this.read();
    return users.find(u => u.id === id) as any;
  }

  async createUser(username: string, role: 'admin'|'supplier', password: string) {
    const users = await this.read();
    if (users.find(u => u.username === username)) throw new Error('User exists');
    // Hash password
    const bcrypt = (await import('bcryptjs')) as typeof import('bcryptjs');
    const hash = await bcrypt.hash(password, 10);
    const user: User = { id: (users[users.length-1]?.id || 0) + 1, username, role, createdAt: new Date(), password: hash } as any;
    users.push(user as any);
    await this.write(users as any);
    return user as any;
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
    async createUser(username: string, role: 'admin'|'supplier', password: string) {
      const bcrypt = (await import('bcryptjs')) as typeof import('bcryptjs');
      const hash = await bcrypt.hash(password, 10);
      const [row] = await db.insert(users).values({ username, role, password: hash }).returning();
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

export async function createJwtForUser(user: User) {
  const jwt = (await import('jsonwebtoken')) as typeof import('jsonwebtoken');
  const secret = process.env.JWT_SECRET || 'dev-secret';
  const token = jwt.sign({ id: (user as any).id, username: user.username, role: user.role }, secret, { expiresIn: '7d' });
  return token;
}