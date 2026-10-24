import userModel from '../models/user.model.js';
import { pool } from '../config/database.js';

export async function getUserProfile(userId) {
  const user = await userModel.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  const { password: _p, ...safeUser } = user;
  return safeUser;
}

export async function updateUserProfile(userId, data) {
  await userModel.updateUser(userId, data);
  return { ok: true };
}

export async function getAllProviders(includeDesigners = true) {
  const users = await userModel.getAllUsers();
  const allowedRoles = includeDesigners ? ['print_provider', 'admin', 'designer'] : ['print_provider', 'admin'];
  const matchedUsers = users.filter((u) => allowedRoles.includes(u.role));

  if (pool) {
    try {
      const prodCounts = await pool.query(
        `SELECT owner_id, COUNT(*) as count FROM products_full WHERE COALESCE(is_deleted, false) = false GROUP BY owner_id`
      );
      const designerCounts = await pool.query(
        `SELECT associated_provider_id, COUNT(*) as count FROM users WHERE associated_provider_id IS NOT NULL GROUP BY associated_provider_id`
      );
      const prodMap = Object.fromEntries(prodCounts.rows.map((r) => [r.owner_id, Number(r.count)]));
      const desMap = Object.fromEntries(designerCounts.rows.map((r) => [r.associated_provider_id, Number(r.count)]));

      return matchedUsers.map((p) => ({
        ...p,
        products_count: prodMap[p.id] || 0,
        designers_count: desMap[p.id] || 0
      }));
    } catch {
      // ignore
    }
  }

  return matchedUsers.map((p) => ({
    ...p,
    products_count: 0,
    designers_count: 0
  }));
}

export async function getPublicProviders() {
  const users = await userModel.getAllUsers();
  const activeProviders = users.filter(
    (u) => (u.role === 'print_provider' || u.role === 'admin') && (u.status === 'active' || !u.status)
  );

  let prodMap = {};
  if (pool) {
    try {
      const prodCounts = await pool.query(
        `SELECT owner_id, COUNT(*) as count FROM products_full WHERE COALESCE(is_deleted, false) = false GROUP BY owner_id`
      );
      prodMap = Object.fromEntries(prodCounts.rows.map((r) => [r.owner_id, Number(r.count)]));
    } catch {}
  }

  return activeProviders.map((u) => ({
    id: u.id,
    name: u.name || u.email,
    email: u.email,
    store_name: u.store_settings?.store_name || u.name || 'Print Provider Studio',
    products_count: prodMap[u.id] || 0
  }));
}

export async function getDesignersForProvider(providerId) {
  return userModel.getDesignersByProvider(providerId);
}

export async function getStoreSettings(userId) {
  return userModel.getStoreSettings(userId);
}

export async function updateStoreSettings(userId, settings) {
  return userModel.updateStoreSettings(userId, settings);
}

export default {
  getUserProfile,
  updateUserProfile,
  getAllProviders,
  getPublicProviders,
  getDesignersForProvider,
  getStoreSettings,
  updateStoreSettings
};
