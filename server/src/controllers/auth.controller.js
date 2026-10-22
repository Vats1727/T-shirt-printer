import authService from '../services/auth.service.js';

export async function register(req, res, next) {
  try {
    const result = await authService.register(req.body);
    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req, res, next) {
  try {
    const userId = req.user?.sub || req.user?.id;
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(userId, currentPassword, newPassword);
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

export default { register, login, changePassword };
