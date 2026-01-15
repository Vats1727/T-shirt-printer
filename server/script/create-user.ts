#!/usr/bin/env tsx
import { createUser, findByEmail } from '../src/services/userStore';

async function main() {
  const [, , ...args] = process.argv;
  if (args.length < 3) {
    console.log('Usage: tsx script/create-user.ts <email> <password> <role> [name]');
    process.exit(1);
  }
  const [email, password, role, ...rest] = args;
  const name = rest.join(' ') || undefined;
  if (role !== 'admin' && role !== 'supplier') {
    console.error('role must be "admin" or "supplier"');
    process.exit(1);
  }
  const existing = await findByEmail(email);
  if (existing) {
    console.error('A user with that email already exists');
    process.exit(1);
  }
  const user = await createUser({ name, email, role: role as any, password });
  console.log('Created user:', user);
}

main().catch(err => { console.error(err); process.exit(1); });
