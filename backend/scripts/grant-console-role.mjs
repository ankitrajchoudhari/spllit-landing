/**
 * Grant or revoke an admin console role.
 *
 *   node scripts/grant-console-role.mjs <email> <role>
 *   node scripts/grant-console-role.mjs <email> none
 *
 * Roles: super_admin | admin | moderator | support | analyst
 *
 * This is how the FIRST Super Admin is created. After that, use the console's
 * Admins page — it enforces the rank rules and writes an audit row, neither of
 * which a script run from a laptop can meaningfully do.
 *
 * It only ever sets `adminRole`. The legacy `role` / `isAdmin` / `adminStatus`
 * fields are left exactly as they are, because the user-facing app and the old
 * /api/admin routes read them and this script has no business changing what
 * they see.
 */

import { PrismaClient } from '@prisma/client';

const ROLES = ['super_admin', 'admin', 'moderator', 'support', 'analyst'];

const prisma = new PrismaClient();

async function main() {
  const [email, role] = process.argv.slice(2);

  if (!email || !role) {
    console.error('Usage: node scripts/grant-console-role.mjs <email> <role|none>');
    console.error(`Roles: ${ROLES.join(' | ')}`);
    process.exitCode = 1;
    return;
  }

  const normalised = email.trim().toLowerCase();
  const nextRole = role === 'none' ? null : role;

  if (nextRole !== null && !ROLES.includes(nextRole)) {
    console.error(`Unknown role "${role}". Expected one of: ${ROLES.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email: normalised },
    select: { id: true, name: true, email: true, adminRole: true, isActive: true, adminStatus: true },
  });

  if (!user) {
    // Deliberately explicit: the most common cause is granting a role to
    // someone who has not signed in to Spllit yet, so no row exists to grant
    // it to. Creating one here would make an admin account that Firebase does
    // not know about.
    console.error(`No Spllit user with email ${normalised}.`);
    console.error('They must sign in to spllit.app at least once first.');
    process.exitCode = 1;
    return;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { adminRole: nextRole },
    select: { name: true, email: true, adminRole: true, isActive: true, adminStatus: true },
  });

  console.log(
    nextRole
      ? `Granted "${nextRole}" to ${updated.name} <${updated.email}> (was: ${user.adminRole ?? 'none'})`
      : `Revoked console access for ${updated.name} <${updated.email}>`,
  );

  // The console resolves a role to null for anyone inactive, so a grant that
  // will not actually work should say so now rather than at their first login.
  if (nextRole && (!updated.isActive || updated.adminStatus !== 'active')) {
    console.warn('');
    console.warn(
      `WARNING: this account is ${!updated.isActive ? 'deactivated' : `adminStatus=${updated.adminStatus}`},`,
    );
    console.warn('so the console will still refuse it. Reactivate the account first.');
  }
}

main()
  .catch((error) => {
    console.error('Failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
