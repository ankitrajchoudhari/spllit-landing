/**
 * Carry suspensions made before `User.suspendedAt` existed onto that field.
 *
 *   node scripts/backfill-suspended-at.mjs            # dry run
 *   node scripts/backfill-suspended-at.mjs --apply
 *
 * Suspension is now enforced from `suspendedAt`, not `isActive`, because the
 * legacy socket wrote `isActive` on every connect and disconnect and most rows
 * carry `false` with no suspension behind it (see audit-user-active.mjs).
 *
 * The audit log is the record of real suspensions. For each user whose most
 * recent `user.suspend` / `user.restore` entry is a suspend, and who is still
 * `isActive: false`, this sets `suspendedAt` to that entry's time. Nobody is
 * suspended on the strength of `isActive` alone.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

try {
  const entries = await prisma.auditLog.findMany({
    where: { action: { in: ['user.suspend', 'user.restore'] }, targetType: 'user' },
    select: { action: true, targetId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  /** Latest entry per user wins. */
  const latest = new Map();
  for (const e of entries) if (e.targetId) latest.set(e.targetId, e);

  const suspended = [...latest.values()].filter((e) => e.action === 'user.suspend');
  const rows = await prisma.user.findMany({
    where: {
      id: { in: suspended.map((e) => e.targetId) },
      isActive: false,
      // Unset, not just null: every row predates the field.
      OR: [{ suspendedAt: null }, { suspendedAt: { isSet: false } }],
    },
    select: { id: true, email: true },
  });

  console.log(`audit entries: ${entries.length}, currently suspended per audit: ${suspended.length}`);
  console.log(`to backfill: ${rows.length}`);
  for (const r of rows) console.log(`  ${r.email}`);

  if (!APPLY) {
    console.log('\nDRY RUN — re-run with --apply to write.');
  } else {
    for (const r of rows) {
      await prisma.user.update({
        where: { id: r.id },
        data: { suspendedAt: latest.get(r.id).createdAt },
      });
    }
    console.log(`\nwrote ${rows.length}`);
  }
} finally {
  await prisma.$disconnect();
}
