/**
 * Set one platform setting from the command line.
 *
 *   node scripts/set-setting.mjs security.admin_email_domains '["spllit.app"]'
 *   node scripts/set-setting.mjs security.admin_email_domains '["spllit.app"]' --yes
 *   node scripts/set-setting.mjs --list
 *
 * The console's Settings page is the normal way to do this. This exists for the
 * cases the console cannot cover: setting something before anyone has a role,
 * or recovering from a value that locked everyone out.
 *
 * Two things it does that a bare database write would not:
 *
 * 1. **It checks who the change would lock out.** `security.admin_email_domains`
 *    can remove console access from every admin who is not a Super Admin, and
 *    finding that out by trying to sign in afterwards is an incident.
 * 2. **It writes an audit row.** A setting that changed with no record of who
 *    changed it is exactly the gap the audit log exists to close, and a change
 *    made from a laptop is not less worth recording than one made from the UI.
 */

import os from 'os';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Mirrors resolveAdminRole in src/config/adminRoles.ts. */
const ADMIN_ROLES = ['super_admin', 'admin', 'moderator', 'support', 'analyst'];

function resolveRole(user) {
  if (!user.isActive || user.adminStatus !== 'active') return null;
  if (ADMIN_ROLES.includes(user.adminRole)) return user.adminRole;
  if (user.role === 'admin') return 'super_admin';
  if (user.role === 'subadmin' || user.isAdmin) return 'admin';
  return null;
}

/** Mirrors emailDomainAllowed. Exact domain match, never a suffix. */
function domainAllowed(email, domains) {
  if (domains.length === 0) return true;
  if (!email) return false;
  const at = email.lastIndexOf('@');
  if (at === -1) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domains.some((allowed) => String(allowed).trim().toLowerCase() === domain);
}

async function listAll() {
  const rows = await prisma.platformSetting.findMany({ orderBy: [{ category: 'asc' }, { key: 'asc' }] });
  if (rows.length === 0) {
    console.log('\nNo settings exist yet. Run: node scripts/seed-console-config.mjs\n');
    return;
  }
  console.log(`\nSettings (${rows.length}):`);
  for (const row of rows) {
    const flag = row.requiresConfirmation ? ' [sensitive]' : '';
    console.log(`  ${row.key} (${row.valueType}) = ${JSON.stringify(row.value)}${flag}`);
  }
  console.log('');
}

/** Warns about admins a new domain list would exclude. Returns those users. */
async function lockoutCheck(domains) {
  const candidates = await prisma.user.findMany({
    where: {
      OR: [{ adminRole: { not: null } }, { role: { in: ['admin', 'subadmin'] } }, { isAdmin: true }],
    },
    select: {
      email: true,
      name: true,
      adminRole: true,
      role: true,
      isAdmin: true,
      adminStatus: true,
      isActive: true,
    },
  });

  const admins = candidates
    .map((user) => ({ ...user, consoleRole: resolveRole(user) }))
    .filter((user) => user.consoleRole !== null);

  // Super Admins are exempt from the domain check, by design — see the note in
  // middleware/adminConsole.ts. They cannot be locked out by this setting.
  const excluded = admins.filter(
    (user) => user.consoleRole !== 'super_admin' && !domainAllowed(user.email, domains),
  );

  const survivingSuperAdmins = admins.filter((user) => user.consoleRole === 'super_admin');

  return { admins, excluded, survivingSuperAdmins };
}

async function main() {
  if (process.argv.includes('--list')) {
    await listAll();
    return;
  }

  const [key, raw] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const assumeYes = process.argv.includes('--yes');

  if (!key || raw === undefined) {
    console.error("Usage: node scripts/set-setting.mjs <key> '<json-value>' [--yes]");
    console.error('       node scripts/set-setting.mjs --list');
    process.exitCode = 1;
    return;
  }

  const setting = await prisma.platformSetting.findUnique({ where: { key } });
  if (!setting) {
    console.error(`No setting named "${key}".`);
    console.error('Run scripts/seed-console-config.mjs first, or --list to see what exists.');
    process.exitCode = 1;
    return;
  }

  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    // Bare strings are the common case and quoting JSON inside a shell is
    // fiddly, so a string setting accepts an unquoted argument.
    if (setting.valueType === 'string') {
      value = raw;
    } else {
      console.error(`Could not parse "${raw}" as JSON for a ${setting.valueType} setting.`);
      console.error(`Example: node scripts/set-setting.mjs ${key} '["spllit.app"]'`);
      process.exitCode = 1;
      return;
    }
  }

  // Same type gate the API applies, so the two cannot disagree about what is
  // valid for a given setting.
  const actual = Array.isArray(value) ? 'json' : typeof value;
  const typeOk =
    (setting.valueType === 'string' && actual === 'string') ||
    (setting.valueType === 'number' && actual === 'number' && Number.isFinite(value)) ||
    (setting.valueType === 'boolean' && actual === 'boolean') ||
    setting.valueType === 'json';

  if (!typeOk) {
    console.error(`"${key}" expects a ${setting.valueType}, but received a ${actual}.`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n${key}`);
  console.log(`  from: ${JSON.stringify(setting.value)}`);
  console.log(`  to:   ${JSON.stringify(value)}`);

  // The check that makes this script worth having.
  if (key === 'security.admin_email_domains') {
    const domains = Array.isArray(value) ? value : [];
    const { admins, excluded, survivingSuperAdmins } = await lockoutCheck(domains);

    console.log(`\n  ${admins.length} account(s) currently hold a console role.`);

    if (survivingSuperAdmins.length === 0) {
      console.error('\n  REFUSED: there is no Super Admin.');
      console.error('  Super Admins are the only role exempt from this restriction, so with none');
      console.error('  in place a wrong domain here is unrecoverable from the console.');
      console.error('  Grant one first: node scripts/grant-console-role.mjs <email> super_admin');
      process.exitCode = 1;
      return;
    }

    if (excluded.length > 0) {
      console.log(`\n  ${excluded.length} admin(s) would LOSE console access:`);
      for (const user of excluded) {
        console.log(`    - ${user.name} <${user.email}> (${user.consoleRole})`);
      }
      console.log('\n  Super Admins are exempt and keep access:');
      for (const user of survivingSuperAdmins) {
        console.log(`    - ${user.name} <${user.email}>`);
      }

      if (!assumeYes) {
        console.error('\n  Nothing was changed. Re-run with --yes to apply anyway.');
        process.exitCode = 1;
        return;
      }
      console.log('\n  --yes given, applying.');
    } else {
      console.log('  No admin would lose access.');
    }
  }

  await prisma.platformSetting.update({
    where: { key },
    data: { value, updatedBy: null },
  });

  // A change made from a laptop is not less worth recording than one made from
  // the console. `actorId` is not a real user id and is prefixed so it can
  // never be mistaken for one.
  await prisma.auditLog.create({
    data: {
      actorId: 'script:set-setting',
      actorEmail: `${os.userInfo().username}@${os.hostname()}`,
      actorRole: 'super_admin',
      action: 'setting.change',
      targetType: 'setting',
      targetId: setting.id,
      targetLabel: key,
      before: { value: setting.value },
      after: { value },
      reason: 'Changed with scripts/set-setting.mjs',
      success: true,
    },
  });

  console.log('\nSaved, and recorded in the audit log.');
  console.log('Running containers cache settings for 30s, so this takes effect within a minute.\n');
}

main()
  .catch((error) => {
    console.error('Failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
