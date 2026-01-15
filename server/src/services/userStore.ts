import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import { pool as exportedPool } from '../../db';
import { Pool } from 'pg';

const usersFile = path.resolve(process.cwd(), 'users.json');

export type UserRecord = {
  id: number;
  username?: string;
  name?: string;
  email?: string;
  role: 'admin' | 'supplier';
  password: string; // hashed (password or password_hash)
  createdAt?: string;
};

async function readUsers(): Promise<UserRecord[]> {
  try {
    const raw = await fs.readFile(usersFile, 'utf8');
    return JSON.parse(raw) as UserRecord[];
  } catch (e) {
    return [];
  }
}

async function writeUsers(users: UserRecord[]) {
  // ensure directory exists so writes don't fail if path is missing
  const dir = path.dirname(usersFile);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(usersFile, JSON.stringify(users, null, 2), 'utf8');
}

// Helper to get a usable PG pool. If the central pool isn't available but env vars exist,
// create a local pool lazily (handles cases where dotenv wasn't loaded earlier or password
// has surrounding quotes in .env).
let localPool: Pool | null = null;
function sanitizeEnvPassword(p?: string) {
  if (!p) return p;
  // strip surrounding single or double quotes
  return p.replace(/^['"]|['"]$/g, '');
}

function getConnectionStringFromEnv(): string | null {
  const provided = process.env.DATABASE_URL;
  if (provided) return provided;
  const user = process.env.DB_USER;
  const pass = sanitizeEnvPassword(process.env.DB_PASSWORD);
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const dbname = process.env.DB_NAME;
  if (user && pass && dbname) {
    return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${dbname}`;
  }
  return null;
}

function getPool(): Pool | null {
  if (exportedPool) return exportedPool as any as Pool;
  if (localPool) return localPool;
  const conn = getConnectionStringFromEnv();
  if (!conn) return null;
  localPool = new Pool({ connectionString: conn });
  console.log('userStore: created local pg Pool from env');
  return localPool;
}

// DB-backed implementations when pool is available
export async function findByEmail(email: string) {
  const pool = getPool();
  if (pool) {
    const res = await pool.query('SELECT id, name, email, role, password_hash, created_at FROM users WHERE email=$1', [email]);
    const row = res.rows[0];
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      password: row.password_hash,
      createdAt: row.created_at?.toISOString?.() || row.created_at,
    } as UserRecord;
  }

  const users = await readUsers();
  return users.find(u => u.email?.toLowerCase() === email.toLowerCase());
}

export async function findById(id: number) {
  const pool = getPool();
  if (pool) {
    const res = await pool.query('SELECT id, name, email, role, password_hash, created_at FROM users WHERE id=$1', [id]);
    const row = res.rows[0];
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      password: row.password_hash,
      createdAt: row.created_at?.toISOString?.() || row.created_at,
    } as UserRecord;
  }

  const users = await readUsers();
  return users.find(u => u.id === id);
}

export async function createUser({ name, email, role, password }: { name?: string; email: string; role: 'admin' | 'supplier'; password: string; }) {
  const hashed = await bcrypt.hash(password, 10);

  const pool = getPool();
  if (pool) {
    // Insert into DB
    try {
      const res = await pool.query(
        'INSERT INTO users (name, email, password_hash, role, created_at) VALUES ($1,$2,$3,$4,NOW()) RETURNING id, name, email, role, created_at',
        [name || null, email, hashed, role]
      );
      const row = res.rows[0];
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        createdAt: row.created_at?.toISOString?.() || row.created_at,
      } as Omit<UserRecord, 'password'>;
    } catch (err: any) {
      // Handle duplicate email (unique violation)
      if (err && err.code === '23505') {
        throw new Error('email already in use');
      }
      throw err;
    }
  }

  // JSON fallback
  const users = await readUsers();
  const maxId = users.reduce((m, u) => Math.max(m, u.id || 0), 0);
  const user: UserRecord = {
    id: maxId + 1,
    name,
    email,
    role,
    password: hashed,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  await writeUsers(users);
  const { password: _pw, ...out } = user;
  return out as Omit<UserRecord, 'password'>;
}

export async function verifyPassword(user: UserRecord, password: string) {
  return bcrypt.compare(password, user.password);
}
