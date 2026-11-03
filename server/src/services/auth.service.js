import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import userModel from '../models/user.model.js';
import emailService from './email.service.js';

export async function register({ name, email, password, role, associated_provider_id }) {
  if (!email || !password || !role) {
    const err = new Error('Email, password and role are required');
    err.status = 400;
    throw err;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    const err = new Error('Please enter a valid email address');
    err.status = 400;
    throw err;
  }

  if (role !== 'print_provider' && role !== 'designer' && role !== 'customer') {
    const err = new Error('Invalid role selected');
    err.status = 400;
    throw err;
  }

  // Strict email uniqueness check across all roles
  const existing = await userModel.findByEmail(normalizedEmail);
  if (existing) {
    const err = new Error('An account with this email address already exists. Email must be unique across all roles.');
    err.status = 400;
    throw err;
  }

  const user = await userModel.createUser({
    name: name?.trim(),
    email: normalizedEmail,
    role,
    password,
    associated_provider_id
  });

  return user;
}

export async function login({ email, password }) {
  if (!email || !password) {
    const err = new Error('Email & password required');
    err.status = 400;
    throw err;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await userModel.findByEmail(normalizedEmail);
  if (!user) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }

  const isMatch = await userModel.verifyPassword(user, password);
  if (!isMatch) {
    const err = new Error('Invalid email or password');
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
    const err = new Error('Current and new password are required');
    err.status = 400;
    throw err;
  }

  const user = await userModel.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const isMatch = await userModel.verifyPassword(user, currentPassword);
  if (!isMatch) {
    const err = new Error('Incorrect current password');
    err.status = 401;
    throw err;
  }

  if (newPassword.length < 6) {
    const err = new Error('New password must be at least 6 characters long');
    err.status = 400;
    throw err;
  }

  await userModel.updatePassword(user.id, newPassword);
  return { message: 'Password updated successfully' };
}

/**
 * Initiates the forgot password flow:
 * Generates 6-digit random code, saves it with 10-min expiry, and emails the user.
 */
export async function forgotPassword(email) {
  if (!email || !email.trim()) {
    const err = new Error('Email address is required');
    err.status = 400;
    throw err;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await userModel.findByEmail(normalizedEmail);
  if (!user) {
    const err = new Error('No registered account found with this email address');
    err.status = 404;
    throw err;
  }

  // Generate 6-digit random number (100000 - 999999)
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  // Save OTP in database (10 minute expiry)
  await userModel.createPasswordResetOtp(normalizedEmail, otpCode, 10);

  // Send formatted HTML email via Allysoft Email Service
  await emailService.sendPasswordResetOtpEmail({
    to: normalizedEmail,
    name: user.name,
    otp: otpCode
  });

  return {
    success: true,
    message: 'A 6-digit verification code has been sent to your email address.'
  };
}

/**
 * Validates the 6-digit OTP code for an email.
 */
export async function verifyOtp(email, otp) {
  if (!email || !email.trim()) {
    const err = new Error('Email address is required');
    err.status = 400;
    throw err;
  }
  if (!otp || String(otp).trim().length !== 6) {
    const err = new Error('Please enter a valid 6-digit verification code');
    err.status = 400;
    throw err;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const cleanOtp = String(otp).trim();

  const isValid = await userModel.verifyPasswordResetOtp(normalizedEmail, cleanOtp);
  if (!isValid) {
    const err = new Error('Invalid or expired verification code. Please request a new code.');
    err.status = 400;
    throw err;
  }

  return {
    success: true,
    message: 'Verification code verified successfully.'
  };
}

/**
 * Verifies OTP and resets user password.
 */
export async function resetPassword({ email, otp, newPassword }) {
  if (!email || !email.trim()) {
    const err = new Error('Email address is required');
    err.status = 400;
    throw err;
  }
  if (!otp || String(otp).trim().length !== 6) {
    const err = new Error('Valid 6-digit verification code is required');
    err.status = 400;
    throw err;
  }
  if (!newPassword || newPassword.length < 6) {
    const err = new Error('New password must be at least 6 characters long');
    err.status = 400;
    throw err;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const cleanOtp = String(otp).trim();

  const isValid = await userModel.verifyPasswordResetOtp(normalizedEmail, cleanOtp);
  if (!isValid) {
    const err = new Error('Invalid or expired verification code. Please request a new code.');
    err.status = 400;
    throw err;
  }

  // Update password in database
  const updated = await userModel.updatePasswordByEmail(normalizedEmail, newPassword);
  if (!updated) {
    const err = new Error('Failed to update password. Account not found.');
    err.status = 404;
    throw err;
  }

  // Consume OTP so it cannot be used again
  await userModel.consumePasswordResetOtp(normalizedEmail, cleanOtp);

  return {
    success: true,
    message: 'Password reset successfully. You can now log in with your new password.'
  };
}

export default {
  register,
  login,
  changePassword,
  forgotPassword,
  verifyOtp,
  resetPassword
};
