import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// ensure env loaded
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import { pool } from '../db';

async function main() {
  if (!process.env.DB_NAME && !process.env.DATABASE_URL) {
    throw new Error('DB not configured in env');
  }

  if (!pool) {
    throw new Error('Pool not available');
  }

  const filePath = path.resolve(__dirname, '..', 'users.json');
  let dataRaw: string;
  try {
    dataRaw = await fs.readFile(filePath, 'utf-8');
  } catch (e) {
    console.error('users.json not found');
    process.exit(1);
  }

  const users = JSON.parse(dataRaw) as any[];
  console.log('Found', users.length, 'users in JSON');

  for (const u of users) {
    try {
      const res = await pool.query(
        'INSERT INTO users (name, email, password_hash, role, created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (email) DO NOTHING RETURNING id',
        [u.name || null, u.email, u.password, u.role, u.createdAt ? new Date(u.createdAt) : undefined]
      );
      if (res.rows.length) console.log('Inserted user id', res.rows[0].id);
      else console.log('Skipped existing', u.email);
    } catch (err) {
      console.error('Error inserting', u.email, err);
    }
  }

  console.log('User import complete');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});