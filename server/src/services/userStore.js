import fs from "fs/promises";
import path from "path";
import bcrypt from "bcryptjs";
import { pool as exportedPool } from '../../db.js';
import { Pool } from "pg";
const usersFile = path.resolve(process.cwd(), "users.json");
let usersCache = null;
const USERS_CACHE_TTL = 2e3;
async function readUsers() {
  const now = Date.now();
  if (usersCache && now - usersCache.ts < USERS_CACHE_TTL) return usersCache.data;
  try {
    const raw = await fs.readFile(usersFile, "utf8");
    const parsed = JSON.parse(raw);
    usersCache = { ts: now, data: parsed };
    return parsed;
  } catch (e) {
    usersCache = { ts: now, data: [] };
    return [];
  }
}
async function writeUsers(users) {
  const dir = path.dirname(usersFile);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(usersFile, JSON.stringify(users, null, 2), "utf8");
  usersCache = { ts: Date.now(), data: users };
}
let localPool = null;
function sanitizeEnvPassword(p) {
  if (!p) return p;
  return p.replace(/^['"]|['"]$/g, "");
}
function getConnectionStringFromEnv() {
  const provided = process.env.DATABASE_URL;
  if (provided) return provided;
  const user = process.env.DB_USER;
  const pass = sanitizeEnvPassword(process.env.DB_PASSWORD);
  const host = process.env.DB_HOST || "localhost";
  const port = process.env.DB_PORT || "5432";
  const dbname = process.env.DB_NAME;
  if (user && pass && dbname) {
    return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${dbname}`;
  }
  return null;
}
function getPool() {
  if (exportedPool) return exportedPool;
  if (localPool) return localPool;
  const conn = getConnectionStringFromEnv();
  if (!conn) return null;
  localPool = new Pool({ connectionString: conn });
  localPool.on("error", (err) => {
    console.error("userStore localPool error (caught, server staying alive):", err);
  });
  console.log("userStore: created local pg Pool from env with error listener");
  return localPool;
}
export async function findByEmail(email) {
  const pool = getPool();
  if (pool) {
    const res = await pool.query("SELECT id, name, email, role, password_hash, status, subscription_tier, subscription_expiry, associated_provider_id, created_at FROM users WHERE email=$1", [email]);
    const row = res.rows[0];
    if (!row) return void 0;
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
      createdAt: row.created_at?.toISOString?.() || row.created_at
    };
  }
  const users = await readUsers();
  return users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
}
export async function findById(id) {
  const pool = getPool();
  if (pool) {
    const res = await pool.query("SELECT id, name, email, role, password_hash, status, subscription_tier, subscription_expiry, associated_provider_id, store_settings, created_at FROM users WHERE id=$1", [id]);
    const row = res.rows[0];
    if (!row) return void 0;
    let settings = row.store_settings;
    if (typeof settings === "string") {
      try {
        settings = JSON.parse(settings);
      } catch (e) {
      }
    }
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
      store_settings: settings || {},
      createdAt: row.created_at?.toISOString?.() || row.created_at
    };
  }
  const users = await readUsers();
  return users.find((u) => u.id === id);
}
export async function getStoreSettings(userId) {
  const pool = getPool();
  if (pool) {
    const res = await pool.query("SELECT store_settings, name, email FROM users WHERE id = $1", [userId]);
    if (res.rows[0]) {
      let settings = res.rows[0].store_settings;
      if (typeof settings === "string") {
        try {
          settings = JSON.parse(settings);
        } catch (e) {
        }
      }
      return {
        store_settings: settings || {},
        name: res.rows[0].name || "",
        email: res.rows[0].email || ""
      };
    }
  }
  const user = await findById(userId);
  return {
    store_settings: user?.store_settings || {},
    name: user?.name || "",
    email: user?.email || ""
  };
}
export async function updateStoreSettings(userId, settings) {
  const current = await getStoreSettings(userId);
  const merged = { ...current?.store_settings || {}, ...settings || {} };
  const pool = getPool();
  if (pool) {
    await pool.query("UPDATE users SET store_settings = $1, updated_at = NOW() WHERE id = $2", [JSON.stringify(merged), userId]);
    return true;
  }
  const users = await readUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx !== -1) {
    users[idx].store_settings = merged;
    await writeUsers(users);
    return true;
  }
  return false;
}
export async function createUser({ name, email, role, password, associated_provider_id }) {
  const hashed = await bcrypt.hash(password, 10);
  const pool = getPool();
  if (pool) {
    try {
      const initialStatus = role === "print_provider" ? "pending" : "active";
      const res = await pool.query(
        "INSERT INTO users (name, email, password_hash, role, status, associated_provider_id, created_at) VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING id, name, email, role, status, subscription_tier, subscription_expiry, associated_provider_id, created_at",
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
        createdAt: row.created_at?.toISOString?.() || row.created_at
      };
    } catch (err) {
      if (err && err.code === "23505") {
        throw new Error("email already in use");
      }
      throw err;
    }
  }
  const users = await readUsers();
  const maxId = users.reduce((m, u) => Math.max(m, u.id || 0), 0);
  const user = {
    id: maxId + 1,
    name,
    email,
    role,
    password: hashed,
    status: role === "print_provider" ? "pending" : "active",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  users.push(user);
  await writeUsers(users);
  const { password: _pw, ...out } = user;
  return out;
}
export async function getDesignersByProvider(providerId) {
  const pool = getPool();
  if (pool) {
    const res = await pool.query("SELECT id, name, email, role, status, subscription_tier, subscription_expiry, associated_provider_id, created_at FROM users WHERE associated_provider_id = $1 AND role = 'designer' ORDER BY id", [providerId]);
    return res.rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status,
      subscription_tier: row.subscription_tier,
      subscription_expiry: row.subscription_expiry?.toISOString?.() || row.subscription_expiry,
      associated_provider_id: row.associated_provider_id,
      createdAt: row.created_at?.toISOString?.() || row.created_at
    }));
  }
  const users = await readUsers();
  return users.filter((u) => u.associated_provider_id === providerId && u.role === "designer");
}
export async function getAllUsers() {
  const pool = getPool();
  if (pool) {
    const res = await pool.query("SELECT id, name, email, role, status, subscription_tier, subscription_expiry, associated_provider_id, created_at FROM users ORDER BY id");
    return res.rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status,
      subscription_tier: row.subscription_tier,
      subscription_expiry: row.subscription_expiry?.toISOString?.() || row.subscription_expiry,
      associated_provider_id: row.associated_provider_id,
      createdAt: row.created_at?.toISOString?.() || row.created_at
    }));
  }
  return readUsers();
}
export async function updateUser(id, data) {
  const pool = getPool();
  if (pool) {
    const fields = [];
    const values = [];
    let i = 1;
    if (data.status !== void 0) {
      fields.push(`status = $${i++}`);
      values.push(data.status);
    }
    if (data.subscription_tier !== void 0) {
      fields.push(`subscription_tier = $${i++}`);
      values.push(data.subscription_tier);
    }
    if (data.subscription_expiry !== void 0) {
      fields.push(`subscription_expiry = $${i++}`);
      values.push(data.subscription_expiry);
    }
    if (data.associated_provider_id !== void 0) {
      fields.push(`associated_provider_id = $${i++}`);
      values.push(data.associated_provider_id);
    }
    if (data.name !== void 0) {
      fields.push(`name = $${i++}`);
      values.push(data.name);
    }
    if (data.store_settings !== void 0) {
      fields.push(`store_settings = $${i++}`);
      values.push(JSON.stringify(data.store_settings));
    }
    if (fields.length > 0) {
      values.push(id);
      await pool.query(`UPDATE users SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${i}`, values);
    }
  }
  const users = await readUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx !== -1) {
    users[idx] = { ...users[idx], ...data };
    await writeUsers(users);
  }
}
export async function updatePassword(id, newPassword) {
  const hashed = await bcrypt.hash(newPassword, 10);
  const pool = getPool();
  if (pool) {
    await pool.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [hashed, id]);
  }
  const users = await readUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx !== -1) {
    users[idx].password = hashed;
    await writeUsers(users);
  }
}
export async function verifyPassword(user, password) {
  return bcrypt.compare(password, user.password);
}
