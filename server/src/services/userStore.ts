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
  role: 'print_provider' | 'designer' | 'portal_admin' | 'admin' | 'supplier';
  password: string; // hashed (password or password_hash)
  status?: string;
  subscription_tier?: string;
  subscription_expiry?: string;
  associated_provider_id?: number | null;
  createdAt?: string;
};

let usersCache: { ts: number; data: UserRecord[] } | null = null;
const USERS_CACHE_TTL = 2000;

async function readUsers(): Promise<UserRecord[]> {
  const now = Date.now();
  if (usersCache && (now - usersCache.ts) < USERS_CACHE_TTL) return usersCache.data;
  try {
    const raw = await fs.readFile(usersFile, 'utf8');
    const parsed = JSON.parse(raw) as UserRecord[];
    usersCache = { ts: now, data: parsed };
    return parsed;
  } catch (e) {
    usersCache = { ts: now, data: [] };
    return [];
  }
}

async function writeUsers(users: UserRecord[]) {
  // ensure directory exists so writes don't fail if path is missing
  const dir = path.dirname(usersFile);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(usersFile, JSON.stringify(users, null, 2), 'utf8');
  usersCache = { ts: Date.now(), data: users };
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
    const res = await pool.query('SELECT id, name, email, role, password_hash, status, subscription_tier, subscription_expiry, associated_provider_id, created_at FROM users WHERE email=$1', [email]);
    const row = res.rows[0];
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      password: row.password_hash,
      status: row.status,
      subscription_tier: row.subscription_tier,
      subscription_expiry: row.subscription_expiry?.toISOString?.() || row.subscription_expiry,
      associated_provider_id: row.associated_provider_id,
      createdAt: row.created_at?.toISOString?.() || row.created_at,
    } as UserRecord;
  }

  const users = await readUsers();
  return users.find(u => u.email?.toLowerCase() === email.toLowerCase());
}

export async function findById(id: number) {
  const pool = getPool();
  if (pool) {
    const res = await pool.query('SELECT id, name, email, role, password_hash, status, subscription_tier, subscription_expiry, associated_provider_id, created_at FROM users WHERE id=$1', [id]);
    const row = res.rows[0];
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      password: row.password_hash,
      status: row.status,
      subscription_tier: row.subscription_tier,
      subscription_expiry: row.subscription_expiry?.toISOString?.() || row.subscription_expiry,
      associated_provider_id: row.associated_provider_id,
      createdAt: row.created_at?.toISOString?.() || row.created_at,
    } as UserRecord;
  }

  const users = await readUsers();
  return users.find(u => u.id === id);
}

export async function createUser({ name, email, role, password, associated_provider_id }: { name?: string; email: string; role: 'print_provider' | 'designer' | 'portal_admin'; password: string; associated_provider_id?: number | null; }) {
  const hashed = await bcrypt.hash(password, 10);

  const pool = getPool();
  if (pool) {
    try {
      const initialStatus = role === 'print_provider' ? 'pending' : 'active';
      const res = await pool.query(
        'INSERT INTO users (name, email, password_hash, role, status, associated_provider_id, created_at) VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING id, name, email, role, status, subscription_tier, subscription_expiry, associated_provider_id, created_at',
        [name || null, email, hashed, role, initialStatus, associated_provider_id || null]
      );
      const row = res.rows[0];
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        status: row.status,
        subscription_tier: row.subscription_tier,
        subscription_expiry: row.subscription_expiry?.toISOString?.() || row.subscription_expiry,
        associated_provider_id: row.associated_provider_id,
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
    status: role === 'print_provider' ? 'pending' : 'active',
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  await writeUsers(users);
  const { password: _pw, ...out } = user;
  return out as Omit<UserRecord, 'password'>;
}

export async function getDesignersByProvider(providerId: number): Promise<UserRecord[]> {
  const pool = getPool();
  if (pool) {
    const res = await pool.query('SELECT id, name, email, role, status, subscription_tier, subscription_expiry, associated_provider_id, created_at FROM users WHERE associated_provider_id = $1 AND role = \'designer\' ORDER BY id', [providerId]);
    return res.rows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status,
      subscription_tier: row.subscription_tier,
      subscription_expiry: row.subscription_expiry?.toISOString?.() || row.subscription_expiry,
      associated_provider_id: row.associated_provider_id,
      createdAt: row.created_at?.toISOString?.() || row.created_at,
    })) as UserRecord[];
  }
  const users = await readUsers();
  return users.filter(u => u.associated_provider_id === providerId && u.role === 'designer');
}

export async function getAllUsers(): Promise<UserRecord[]> {
  const pool = getPool();
  if (pool) {
    const res = await pool.query('SELECT id, name, email, role, status, subscription_tier, subscription_expiry, associated_provider_id, created_at FROM users ORDER BY id');
    return res.rows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status,
      subscription_tier: row.subscription_tier,
      subscription_expiry: row.subscription_expiry?.toISOString?.() || row.subscription_expiry,
      associated_provider_id: row.associated_provider_id,
      createdAt: row.created_at?.toISOString?.() || row.created_at,
    })) as UserRecord[];
  }
  return readUsers();
}

export async function updateUser(id: number, data: Partial<Omit<UserRecord, 'id' | 'password'>>) {
  const pool = getPool();
  if (pool) {
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (data.status !== undefined) { fields.push(`status = $${i++}`); values.push(data.status); }
    if (data.subscription_tier !== undefined) { fields.push(`subscription_tier = $${i++}`); values.push(data.subscription_tier); }
    if (data.subscription_expiry !== undefined) { fields.push(`subscription_expiry = $${i++}`); values.push(data.subscription_expiry); }
    if (data.associated_provider_id !== undefined) { fields.push(`associated_provider_id = $${i++}`); values.push(data.associated_provider_id); }
    if (data.name !== undefined) { fields.push(`name = $${i++}`); values.push(data.name); }

    if (fields.length > 0) {
      values.push(id);
      await pool.query(`UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${i}`, values);
    }
  }

  // Always update JSON for consistency
  const users = await readUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx !== -1) {
    users[idx] = { ...users[idx], ...data };
    await writeUsers(users);
  }
}

export async function updatePassword(id: number, newPassword: string) {
  const hashed = await bcrypt.hash(newPassword, 10);
  const pool = getPool();
  if (pool) {
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hashed, id]);
  }

  // Always update JSON for consistency
  const users = await readUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx !== -1) {
    users[idx].password = hashed;
    await writeUsers(users);
  }
}

export async function verifyPassword(user: UserRecord, password: string) {
  return bcrypt.compare(password, user.password);
}
