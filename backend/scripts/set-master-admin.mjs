/**
 * Create or rotate the legacy master admin (the `Admin` collection).
 *
 * /api/admin/login used to create this row on first sign-in with a password
 * committed to the repository. That path is gone; this is the only way in.
 *
 *   MASTER_ADMIN_PASSWORD='…' node scripts/set-master-admin.mjs you@spllit.app
 *   MASTER_ADMIN_PASSWORD='…' node scripts/set-master-admin.mjs you@spllit.app "Display Name"
 *
 * The password comes from the environment, not argv, so it stays out of shell
 * history and the process list.
 */
import { createHash } from 'node:crypto';

import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const [rawEmail, name = 'Master Admin'] = process.argv.slice(2);
const password = process.env.MASTER_ADMIN_PASSWORD ?? '';

if (!rawEmail) {
  console.error('Usage: MASTER_ADMIN_PASSWORD=… node scripts/set-master-admin.mjs <email> [name]');
  process.exit(1);
}
if (password.length < 12) {
  console.error('MASTER_ADMIN_PASSWORD must be set and at least 12 characters.');
  process.exit(1);
}

/** Mirrors BUILT_IN_DIGESTS in src/utils/passwordPolicy.ts. */
const COMPROMISED = new Set([
  '52d2a30ff2707a467bc1ad150febe58553b0879f81301c5b934032ff8e3d22a1',
]);
if (COMPROMISED.has(createHash('sha256').update(password).digest('hex'))) {
  console.error('That password is on the compromised list. Pick another.');
  process.exit(1);
}

const email = rawEmail.trim().toLowerCase();
const prisma = new PrismaClient();

try {
  const hashed = await bcrypt.hash(password, 10);
  const admin = await prisma.admin.upsert({
    where: { email },
    update: { password: hashed, isActive: true, role: 'master' },
    create: { email, password: hashed, name, role: 'master' },
    select: { id: true, email: true, role: true, isActive: true },
  });
  console.log('master admin set:', admin);
} finally {
  await prisma.$disconnect();
}
