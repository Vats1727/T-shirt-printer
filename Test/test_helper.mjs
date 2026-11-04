import jwt from '../server/node_modules/jsonwebtoken/index.js';
import { pool } from '../server/src/config/database.js';

export async function resolveTestUsers() {
  if (!pool) {
    throw new Error('Database pool not available');
  }

  // Find admin
  let adminRes = await pool.query("SELECT id, email, role, name FROM users WHERE role = 'portal_admin' LIMIT 1");
  let admin = adminRes.rows[0];

  // Find designer
  let designerRes = await pool.query("SELECT id, email, role, name FROM users WHERE role = 'designer' LIMIT 1");
  let designer = designerRes.rows[0];

  // Find provider
  let providerRes = await pool.query("SELECT id, email, role, name FROM users WHERE role = 'print_provider' LIMIT 1");
  let provider = providerRes.rows[0];

  // Find or create customer
  let customerRes = await pool.query("SELECT id, email, role, name FROM users WHERE role = 'customer' LIMIT 1");
  let customer = customerRes.rows[0];

  if (!customer) {
    const insertRes = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, status, subscription_tier, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id, email, role, name`,
      ['Customer One', 'customerone@gmail.com', '$2b$10$/8FC0Ck6SxESPTt.6wLGOOcvlpoKVGnf3z5sdl.as2yYw3mMWCXXG', 'customer', 'active', 'free']
    );
    customer = insertRes.rows[0];
  }

  return { admin, designer, provider, customer };
}

export function generateTestTokens(users, jwtSecret) {
  const adminToken = jwt.sign(
    { sub: Number(users.admin.id), id: Number(users.admin.id), role: users.admin.role, email: users.admin.email, name: users.admin.name },
    jwtSecret,
    { expiresIn: '1d' }
  );

  const designerToken = jwt.sign(
    { sub: Number(users.designer.id), id: Number(users.designer.id), role: users.designer.role, email: users.designer.email, name: users.designer.name },
    jwtSecret,
    { expiresIn: '1d' }
  );

  const providerToken = jwt.sign(
    { sub: Number(users.provider.id), id: Number(users.provider.id), role: users.provider.role, email: users.provider.email, name: users.provider.name },
    jwtSecret,
    { expiresIn: '1d' }
  );

  const customerToken = jwt.sign(
    { sub: Number(users.customer.id), id: Number(users.customer.id), role: users.customer.role, email: users.customer.email, name: users.customer.name },
    jwtSecret,
    { expiresIn: '1d' }
  );

  return { adminToken, designerToken, providerToken, customerToken };
}

if (process.argv[1]?.endsWith('test_helper.mjs')) {
  try {
    const users = await resolveTestUsers();
    console.log('Resolved users:', users);
    const tokens = generateTestTokens(users, 'dev-secret-key-123');
    console.log('Generated tokens successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error in test_helper:', err);
    process.exit(1);
  }
}

