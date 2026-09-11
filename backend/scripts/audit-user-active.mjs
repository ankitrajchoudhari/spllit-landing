/**
 * Report — and optionally repair — the `isActive` flag on user accounts.
 *
 *   node scripts/audit-user-active.mjs           # report only, writes nothing
 *   node scripts/audit-user-active.mjs --fix     # set isActive true for everyone
 *
 * ## Why this exists
 *
 * `isActive` reads like "can this account be used" and does not behave like it.
 * The Firebase bootstrap path never checks it, so accounts carrying `false`
 * sign in and use Spllit normally. At the time of writing 205 of 229 accounts
 * were `false`, including ones seen in the previous week, and nothing in the
 * codebase writes it except the console's audited suspend — which had never
 * been used.
 *
 * That mattered because broadcast audiences filtered on it, so "everyone
 * onboarded" quietly meant a tenth of the users. The audiences no longer do.
 * This is for deciding what to do about the data itself.
 *
 * The report is the point; `--fix` is blunt on purpose. It sets *every* account
 * active, which is right only if you have established that no real suspension
 * is recorded in this field. Read the report first — if anybody in it was
 * genuinely suspended, fix them individually from the console instead, where it
 * is audited.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const fix = process.argv.includes('--fix');

const DAY = 86_400_000;

async function main() {
  const [total, active, inactive] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: false } }),
  ]);

  const [onboarded, seenWeek, withRides] = await Promise.all([
    prisma.user.count({ where: { isActive: false, onboarded: true } }),
    prisma.user.count({
      where: { isActive: false, lastSeen: { gte: new Date(Date.now() - 7 * DAY) } },
    }),
    prisma.user.count({ where: { isActive: false, totalRides: { gt: 0 } } }),
  ]);

  console.log(`\naccounts            ${total}`);
  console.log(`  isActive true     ${active}`);
  console.log(`  isActive false    ${inactive}`);
  console.log(`\nof the inactive:`);
  console.log(`  fully onboarded   ${onboarded}`);
  console.log(`  seen in last 7d   ${seenWeek}   <- these people are using the app`);
  console.log(`  have taken rides  ${withRides}`);

  /**
   * The console records suspensions. If the flag were being set deliberately,
   * this is where the evidence would be — and its absence is the strongest
   * argument that the data is wrong rather than the filter.
   */
  const suspensions = await prisma.auditLog.count({ where: { action: 'user.suspend' } });
  console.log(`\naudited suspensions in the console: ${suspensions}`);
  if (suspensions === 0 && inactive > 0) {
    console.log('  → no suspension was ever recorded, so nothing here was deliberate.');
  }

  if (!fix) {
    console.log(`\nReport only. Re-run with --fix to set all ${inactive} accounts active.`);
    return;
  }

  if (suspensions > 0) {
    console.log(
      `\nRefusing --fix: ${suspensions} suspension(s) are recorded in the audit log, so this` +
        ' field carries at least one deliberate decision. Restore those accounts from the' +
        ' console instead, where it is audited.',
    );
    process.exitCode = 1;
    return;
  }

  const { count } = await prisma.user.updateMany({
    where: { isActive: false },
    data: { isActive: true },
  });
  console.log(`\nSet ${count} accounts active.`);
}

main()
  .catch((error) => {
    console.error('\nFailed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
