import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import * as userStore from '../services/userStore';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const TOKEN_EXP = '7d';

export async function register(req: Request, res: Response) {
  const { name, email, password, role, associated_provider_id } = req.body;
  if (!email || !password || !role) {
    return res.status(400).json({ message: 'email, password and role are required' });
  }
  if (role !== 'print_provider' && role !== 'designer') {
    return res.status(400).json({ message: 'invalid role' });
  }

  const existing = await userStore.findByEmail(email);
  if (existing) return res.status(400).json({ message: 'email already in use' });

  const user = await userStore.createUser({ name, email, role, password, associated_provider_id });
  return res.status(201).json(user);
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'email & password required' });

  const user = await userStore.findByEmail(email as string);
  if (!user) return res.status(401).json({ message: 'invalid credentials' });

  const ok = await userStore.verifyPassword(user as any, password as string);
  if (!ok) return res.status(401).json({ message: 'invalid credentials' });

  const token = jwt.sign({ sub: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_EXP });
  return res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, associated_provider_id: user.associated_provider_id } });
}

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = req.body;
  const userId = (req as any).user?.sub;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'current and new password are required' });
  }

  const user = await userStore.findById(userId);
  if (!user) return res.status(404).json({ message: 'user not found' });

  const ok = await userStore.verifyPassword(user as any, currentPassword);
  if (!ok) return res.status(401).json({ message: 'incorrect current password' });

  await userStore.updatePassword(user.id, newPassword);
  return res.json({ message: 'password updated' });
}
