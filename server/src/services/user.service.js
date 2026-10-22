import userModel from '../models/user.model.js';

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

export async function getAllProviders() {
  const users = await userModel.getAllUsers();
  return users.filter((u) => u.role === 'print_provider' || u.role === 'admin');
}

export async function getPublicProviders() {
  const providers = await getAllProviders();
  return providers.map((u) => ({ id: u.id, name: u.name || u.email }));
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
