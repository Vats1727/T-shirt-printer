import { pool } from '../config/database.js';

export async function findAssetById(id) {
  if (!pool) return null;
  const res = await pool.query('SELECT * FROM assets WHERE id = $1', [Number(id)]);
  return res.rows[0] || null;
}

export async function createAsset({ filename, mime, size, storage_key, metadata, uploader_id, owner_id }) {
  if (!pool) return null;
  const res = await pool.query(
    `INSERT INTO assets (filename, mime, size, storage_key, metadata, uploader_id, owner_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     RETURNING *`,
    [filename, mime, size, storage_key, metadata ? JSON.stringify(metadata) : null, uploader_id || null, owner_id || null]
  );
  return res.rows[0];
}

export async function deleteAssetById(id, userId) {
  if (!pool) return false;
  let query = 'DELETE FROM assets WHERE id = $1';
  const params = [Number(id)];
  if (userId) {
    query += ' AND (uploader_id = $2 OR owner_id = $2)';
    params.push(Number(userId));
  }
  const res = await pool.query(query, params);
  return (res.rowCount || 0) > 0;
}

export default { findAssetById, createAsset, deleteAssetById };
