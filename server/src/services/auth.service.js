import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import userModel from '../models/user.model.js';

export async function register({ name, email, password, role, associated_provider_id }) {
  if (!email || !password || !role) {
    const err = new Error('email, password and role are required');
    err.status = 400;
    throw err;
  }
  if (role !== 'print_provider' && role !== 'designer') {
    const err = new Error('invalid role');
    err.status = 400;
    throw err;
  }

  const existing = await userModel.findByEmail(email);
  if (existing) {
    const err = new Error('email already in use');
    err.status = 400;
    throw err;
  }

  const user = await userModel.createUser({ name, email, role, password, associated_provider_id });
  return user;
}

export async function login({ email, password }) {
  if (!email || !password) {
    const err = new Error('email & password required');
    err.status = 400;
    throw err;
  }

  const user = await userModel.findByEmail(email);
  if (!user) {
    const err = new Error('invalid credentials');
    err.status = 401;
    throw err;
  }

  const isMatch = await userModel.verifyPassword(user, password);
  if (!isMatch) {
    const err = new Error('invalid credentials');
    err.status = 401;
    throw err;
  }

  // Approval gate for Print Providers and Designers
  if (user.role === 'print_provider' || user.role === 'designer') {
    const status = (user.status || 'pending').toLowerCase();
    const roleLabel = user.role === 'designer' ? 'designer' : 'print provider';
    if (status === 'pending') {
      const err = new Error(`Your ${roleLabel} registration request is currently under review by the portal administrator. Please wait for acceptance before signing in.`);
      err.status = 403;
      err.code = 'PENDING_APPROVAL';
      throw err;
    }
    if (status === 'rejected') {
      const err = new Error(`Your ${roleLabel} registration was rejected by the portal administrator. Please contact support.`);
      err.status = 403;
      err.code = 'REGISTRATION_REJECTED';
      throw err;
    }
    if (status === 'suspended') {
      const err = new Error(`Your ${roleLabel} account has been suspended by the portal administrator. Access is restricted.`);
      err.status = 403;
      err.code = 'ACCOUNT_SUSPENDED';
      throw err;
    }
  }

  const token = jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRY }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      associated_provider_id: user.associated_provider_id
    }
  };
}

export async function changePassword(userId, currentPassword, newPassword) {
  if (!currentPassword || !newPassword) {
    const err = new Error('current and new password are required');
    err.status = 400;
    throw err;
  }

  const user = await userModel.findById(userId);
  if (!user) {
    const err = new Error('user not found');
    err.status = 404;
    throw err;
  }

  const isMatch = await userModel.verifyPassword(user, currentPassword);
  if (!isMatch) {
    const err = new Error('incorrect current password');
    err.status = 401;
    throw err;
  }

  await userModel.updatePassword(user.id, newPassword);
  return { message: 'password updated' };
}

export default { register, login, changePassword };
