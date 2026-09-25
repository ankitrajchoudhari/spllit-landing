/**
 * Verify people whose sign-in address already proves their institute.
 *
 *   node scripts/backfill-institute-verification.mjs                 # dry run
 *   node scripts/backfill-institute-verification.mjs --apply         # matched instituteId only
 *   node scripts/backfill-institute-verification.mjs --apply --infer # also infer the institute
 *
 * ## Why this is needed
 *
 * Auto-verification runs at onboarding, and only for someone who has *already*
 * chosen an institute (`usersPlatform.ts`, POST /users/me/profile). Anyone who
 * signed in with a campus address but never picked an institute from the list
 * was left unverified — and the rides gate then blocks them, despite their
 * holding the exact credential it asks for.
 *
 * ## What "proof" means here
 *
 * The same thing it means everywhere else in Spllit: the address is one Google
 * vouched for at sign-in, on a domain `INSTITUTE_DOMAINS` lists for that
 * institute. `emailMatchesInstitute` is reused rather than reimplemented, so
 * this cannot drift from the rule the live gate applies — including its refusal
 * of look-alikes such as `evil-iitm.ac.in`.
 *
 * ## Two categories, kept apart on purpose
 *
 * A. **Matched** — the user picked an institute and their address matches it.
 *    Backfilling these applies the existing rule to rows that predate it.
 *
 * B. **Inferred** — no institute chosen, but the address matches exactly one.
 *    This is a judgement the product has not made before, so it is behind its
 *    own flag. Addresses matching more than one institute are skipped rather
 *    than guessed.
 *
 * Dry run by default. Nothing is written without --apply.
 *
 * Reads `emailMatchesInstitute` from `dist/`, so run `npm run build` first if
 * `src/data/institutes.ts` has changed since the last build — otherwise this
 * applies yesterday's domain list, which is exactly the drift it exists to
 * avoid.
 */

import os from 'os';

import { PrismaClient } from '@prisma/client';

import { INSTITUTE_DOMAINS, emailMatchesInstitute } from '../dist/data/institutes.js';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const INFER = process.argv.includes('--infer');

/** The one institute this address proves, or null when it is 0 or several. */
function inferInstitute(email) {
  const matches = Object.keys(INSTITUTE_DOMAINS).filter((id) => emailMatchesInstitute(email, id));
  return matches.length === 1 ? matches[0] : null;
}

async function main() {
  /**
   * `$ne: true` rather than `false`.
   *
   * Most User documents predate the field and simply do not have it — Prisma
   * reads those as the schema default, but a `{ instituteVerified: false }`
   * filter does not match a missing field, and would silently skip them. That
   * is the difference between seeing 30 candidates and seeing 101.
   */
  const result = await prisma.$runCommandRaw({
    find: 'User',
    // Only addresses someone proved they own. An unverified email is a string
    // typed at /api/auth/register, and verifying a campus from it let anyone
    // become "IIT Madras verified" by typing a campus address.
    filter: { instituteVerified: { $ne: true }, emailVerified: true },
    projection: { _id: 1, email: 1, instituteId: 1, college: 1 },
    limit: 5000,
  });

  const rows = result?.cursor?.firstBatch ?? [];

  const matched = [];
  const inferred = [];
  const ambiguous = [];

  for (const row of rows) {
    if (!row.email) continue;

    if (row.instituteId) {
      if (emailMatchesInstitute(row.email, row.instituteId)) {
        matched.push({ ...row, target: row.instituteId });
      }
      continue;
    }

    const guess = inferInstitute(row.email);
    if (guess) inferred.push({ ...row, target: guess });
    else if (/\.(ac|edu)\.[a-z.]+$/i.test(String(row.email).split('@')[1] ?? '')) {
      ambiguous.push(row);
    }
  }

  console.log(`\nUnverified accounts examined: ${rows.length}`);
  console.log(`  A. institute chosen and address matches : ${matched.length}`);
  console.log(`  B. address matches exactly one institute: ${inferred.length}`);
  console.log(`  -. academic address, no single match    : ${ambiguous.length} (never touched)`);

  const selected = INFER ? [...matched, ...inferred] : matched;

  if (selected.length === 0) {
    console.log('\nNothing to do.');
    if (!INFER && inferred.length > 0) {
      console.log(`Add --infer to include the ${inferred.length} in category B.`);
    }
    return;
  }

  console.log(`\nWould verify ${selected.length} account(s):`);
  for (const row of selected.slice(0, 25)) {
    const how = row.instituteId ? 'matched' : 'inferred';
    console.log(`  ${row.email} -> ${row.target} (${how})`);
  }
  if (selected.length > 25) console.log(`  … and ${selected.length - 25} more`);

  if (!APPLY) {
    console.log('\nDRY RUN — nothing was changed. Re-run with --apply to write.');
    if (!INFER && inferred.length > 0) {
      console.log(`Add --infer to also include the ${inferred.length} in category B.`);
    }
    return;
  }

  let written = 0;
  for (const row of selected) {
    await prisma.user.update({
      where: { id: row._id },
      data: {
        instituteId: row.target,
        instituteEmail: String(row.email).toLowerCase(),
        instituteVerified: true,
      },
    });
    written += 1;
  }

  // One row for the batch, not one per user: this is a single operator action,
  // and 55 identical audit entries would bury the fact that it happened once.
  await prisma.auditLog.create({
    data: {
      actorId: 'script:backfill-institute-verification',
      actorEmail: `${os.userInfo().username}@${os.hostname()}`,
      actorRole: 'super_admin',
      action: 'user.institute_verify_backfill',
      targetType: 'user',
      targetLabel: `${written} account(s)`,
      after: {
        verified: written,
        matched: matched.length,
        inferred: INFER ? inferred.length : 0,
      },
      reason: 'Sign-in address already proved the institute; onboarding never asked.',
      success: true,
    },
  });

  console.log(`\nVerified ${written} account(s), and recorded it in the audit log.`);
}

main()
  .catch((error) => {
    console.error('Failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
