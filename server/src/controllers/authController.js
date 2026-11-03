import authService from '../services/auth.service.js';

export async function register(req, res) {
  const result = await authService.register(req.body);
  return res.status(201).json(result);
}

export async function login(req, res) {
  const result = await authService.login(req.body);
  return res.json(result);
}

export async function changePassword(req, res) {
  const userId = req.user?.sub || req.user?.id;
  const { currentPassword, newPassword } = req.body;
  const result = await authService.changePassword(userId, currentPassword, newPassword);
  return res.json(result);
}

export async function forgotPassword(req, res) {
  const { email } = req.body;
  const result = await authService.forgotPassword(email);
  return res.json(result);
}

export async function verifyOtp(req, res) {
  const { email, otp } = req.body;
  const result = await authService.verifyOtp(email, otp);
  return res.json(result);
}

export async function resetPassword(req, res) {
  const { email, otp, newPassword } = req.body;
  const result = await authService.resetPassword({ email, otp, newPassword });
  return res.json(result);
}

export default {
  register,
  login,
  changePassword,
  forgotPassword,
  verifyOtp,
  resetPassword
};
