import jwt from 'jsonwebtoken';
import env from '../config/env.js';

export function expressAuthenticateOptional(req, _res, next) {
  const auth = req.headers.authorization;
  if (!auth) return next();
  const [, token] = auth.split(' ');
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = payload;
  } catch (e) {
    // ignore
  }
  return next();
}

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: 'Missing authorization header' });
  const [, token] = auth.split(' ');
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = payload;
    return next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

export const authenticateToken = requireAuth;
export const authenticateOptional = expressAuthenticateOptional;

export function requireRole(role) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Not authenticated' });

    const roleMap = {
      'print_provider': ['print_provider', 'admin', 'portal_admin'],
      'designer': ['designer', 'supplier', 'admin', 'portal_admin'],
      'portal_admin': ['portal_admin'],
      'admin': ['admin', 'portal_admin'],
      'supplier': ['supplier', 'designer', 'admin', 'portal_admin'],
      'customer': ['customer', 'admin', 'portal_admin']
    };

    const allowedRoles = Array.isArray(role) ? role : (roleMap[role] || [role]);
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    return next();
  };
}

export function requirePermission(permission) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Not authenticated' });

    // Explicit financial confirmation permission check:
    if (permission === 'payments.confirm_manual') {
      const authorizedRoles = ['portal_admin', 'admin'];
      if (!authorizedRoles.includes(user.role)) {
        return res.status(403).json({
          message: 'Forbidden: Insufficient permissions to confirm manual payments. Requires financial administrator authorization.'
        });
      }
      return next();
    }

    return next();
  };
}

export default { expressAuthenticateOptional, requireAuth, requireRole, requirePermission };
