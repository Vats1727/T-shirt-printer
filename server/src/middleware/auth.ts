import { Request, Response, NextFunction } from 'express';
import { usersService } from '../services/users';

declare global {
  namespace Express {
    interface Request {
      user?: { id: number; username: string; role: string };
    }
  }
}

import jwt from 'jsonwebtoken';

export async function authFromHeader(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers['authorization'] as string | undefined;
  if (!auth) return res.status(401).json({ message: 'Missing Authorization header' });
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ message: 'Invalid Authorization header' });
  const token = parts[1];
  try {
    const secret = process.env.JWT_SECRET || 'dev-secret';
    const payload = jwt.verify(token, secret) as any;
    req.user = { id: payload.id, username: payload.username, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

export function requireRole(role: string | string[]) {
  const roles = Array.isArray(role) ? role : [role];
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    if (!roles.includes(user.role)) return res.status(403).json({ message: 'Forbidden' });
    next();
  };
}