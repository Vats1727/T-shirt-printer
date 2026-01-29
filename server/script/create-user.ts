#!/usr/bin/env tsx
import { createUser, findByEmail } from '../src/services/userStore';

async function main() {
  const [, , ...args] = process.argv;
  if (args.length < 3) {
    console.log('Usage: tsx script/create-user.ts <email> <password> <role> [name]');
    (process as any).exitCode = 1;
    return;
  }
  const [email, password, role, ...rest] = args;
  const name = rest.join(' ') || undefined;
  if (role !== 'admin' && role !== 'supplier') {
    console.error('role must be "admin" or "supplier"');
    (process as any).exitCode = 1;
    return;
  }
  const existing = await findByEmail(email);
  if (existing) {
    console.error('A user with that email already exists');
    (process as any).exitCode = 1;
    return;
  }
  const user = await createUser({ name, email, role: role as any, password });
  console.log('Created user:', user);
}

main().catch(err => { console.error(err); (process as any).exitCode = 1; return; });
