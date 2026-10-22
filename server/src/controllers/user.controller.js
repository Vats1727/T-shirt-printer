import userService from '../services/user.service.js';

export async function getProfile(req, res, next) {
  try {
    const userId = req.user?.sub || req.user?.id;
    const profile = await userService.getUserProfile(userId);
    return res.json(profile);
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const userId = req.user?.sub || req.user?.id;
    const result = await userService.updateUserProfile(userId, req.body);
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listDesigners(req, res, next) {
  try {
    const userId = req.user?.sub || req.user?.id;
    const designers = await userService.getDesignersForProvider(userId);
    return res.json(designers);
  } catch (err) {
    next(err);
  }
}

export async function getStoreSettings(req, res, next) {
  try {
    const userId = req.user?.sub || req.user?.id;
    const data = await userService.getStoreSettings(userId);
    return res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function updateStoreSettings(req, res, next) {
  try {
    const userId = req.user?.sub || req.user?.id;
    const { store_settings } = req.body;
    await userService.updateStoreSettings(userId, store_settings || {});
    return res.json({ ok: true, store_settings: store_settings || {} });
  } catch (err) {
    next(err);
  }
}

export async function getPublicProviders(req, res, next) {
  try {
    const providers = await userService.getPublicProviders();
    return res.json(providers);
  } catch (err) {
    next(err);
  }
}

export default {
  getProfile,
  updateProfile,
  listDesigners,
  getStoreSettings,
  updateStoreSettings,
  getPublicProviders
};
