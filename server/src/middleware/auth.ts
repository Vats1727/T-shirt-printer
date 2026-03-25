import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import * as userStore from '../services/userStore';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export function expressAuthenticateOptional(req: Request, _res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth) return next();
  const [, token] = auth.split(' ');
  try {
    const payload: any = jwt.verify(token, JWT_SECRET);
    (req as any).user = payload;
  } catch (e) {
    // ignore
  }
  return next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: 'Missing authorization header' });
  const [, token] = auth.split(' ');
  try {
    const payload: any = jwt.verify(token, JWT_SECRET);
    (req as any).user = payload;
    return next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

export function requireRole(role: 'print_provider' | 'designer' | 'portal_admin') {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ message: 'Not authenticated' });

    const roleMap: Record<string, string[]> = {
      'print_provider': ['print_provider', 'admin'],
      'designer': ['designer', 'supplier'],
      'portal_admin': ['portal_admin']
    };

    const allowedRoles = roleMap[role] || [role];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    return next();
  };
}
