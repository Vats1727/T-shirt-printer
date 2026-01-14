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
    const bcryptMod = await import('bcryptjs');
    const bcrypt = (bcryptMod as any).default ?? bcryptMod;
    const hash = bcrypt.hashSync(password, 10);
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
      const { eq } = await import('drizzle-orm');
      const rows = await db.select().from(users).where(eq(users.username, username));
      return rows[0] as User | undefined;
    },
    async getById(id: number) {
      const { eq } = await import('drizzle-orm');
      const rows = await db.select().from(users).where(eq(users.id, id));
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

// Seed default users for development if no users exist
(async () => {
  try {
    const list = await usersService.listUsers();
    if (!list || list.length === 0) {
      console.log('Seeding initial users (dev): admin/password123 and supplier1/supplierpass');
      // Try to create via service (DB or JSON). If it fails, fall back to writing users.json directly.
      let created = false;
      try {
        await usersService.createUser('admin', 'admin', 'password123');
        await usersService.createUser('supplier1', 'supplier', 'supplierpass');
        created = true;
      } catch (e) {
        console.warn('usersService.createUser failed during seeding, falling back to direct JSON write:', e);
      }

      if (!created) {
        try {
          const bcryptMod = await import('bcryptjs');
          const bcrypt = (bcryptMod as any).default ?? bcryptMod;
          const adminHash = bcrypt.hashSync('password123', 10);
          const supHash = bcrypt.hashSync('supplierpass', 10);
          const seed = [
            { id: 1, username: 'admin', role: 'admin', password: adminHash, createdAt: new Date() },
            { id: 2, username: 'supplier1', role: 'supplier', password: supHash, createdAt: new Date() },
          ];
          await fs.writeFile(usersFile, JSON.stringify(seed, null, 2));
          console.log('Wrote fallback users.json with seeded users (dev)');
        } catch (e) {
          console.warn('Failed to write fallback users.json during seeding:', e);
        }
      }
    } else {
      // Ensure existing users have password hashes (for DB migrations that had no password)
      try {
        const bcryptMod = await import('bcryptjs');
        const bcrypt = (bcryptMod as any).default ?? bcryptMod;

        // Try DB-backed update first (if postgres is available)
        try {
          const modDb = await import('../db');
          const { db } = modDb as any;
          const { users } = await import('@shared/schema');
          const { eq } = await import('drizzle-orm');

          for (const u of list as any[]) {
            if (!u.password) {
              const hash = bcrypt.hashSync(u.username === 'admin' ? 'password123' : 'supplierpass', 10);
              await db.update(users).set({ password: hash }).where(eq(users.id, u.id));
              console.log(`Set password for user ${u.username} (dev DB)`);
            }
          }
        } catch (dbErr) {
          // Fallback to JSON file update
          try {
            const raw = await fs.readFile(usersFile, 'utf-8');
            const arr = JSON.parse(raw) as any[];
            let changed = false;
            for (const obj of arr) {
              if (!obj.password) {
                obj.password = bcrypt.hashSync(obj.username === 'admin' ? 'password123' : 'supplierpass', 10);
                changed = true;
                console.log(`Set password for user ${obj.username} (dev JSON)`);
              }
            }
            if (changed) await fs.writeFile(usersFile, JSON.stringify(arr, null, 2));
          } catch (jsonErr) {
            console.warn('Failed to update users file with password hashes:', jsonErr);
          }
        }
      } catch (e) {
        console.warn('Failed to ensure password hashes for users:', e);
      }
    }
  } catch (e) {
    console.warn('User seeding failed:', e);
  }
})();

export async function createJwtForUser(user: User) {
  const jwt = (await import('jsonwebtoken')) as typeof import('jsonwebtoken');
  const secret = process.env.JWT_SECRET || 'dev-secret';
  const token = jwt.sign({ id: (user as any).id, username: user.username, role: user.role }, secret, { expiresIn: '7d' });
  return token;
}