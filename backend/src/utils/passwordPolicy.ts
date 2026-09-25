import { createHash } from 'node:crypto';

/**
 * Passwords known to be public, refused even when the stored bcrypt hash matches.
 *
 * A leaked password stays dangerous until every row that uses it is rotated, and
 * nothing in the database says which rows those are. Checking the submitted
 * plaintext at sign-in closes that gap: the account keeps its data but cannot be
 * entered with the leaked value, so the leak stops mattering the moment this
 * ships instead of the day someone remembers to rotate.
 *
 * Entries are SHA-256 digests, not plaintext, so this file does not republish
 * what it is blocking. Add more without a deploy through
 * COMPROMISED_PASSWORD_SHA256 (comma-separated hex digests).
 */
const BUILT_IN_DIGESTS = [
  // The legacy master-admin password committed to admin.ts on 2026-01-31.
  '52d2a30ff2707a467bc1ad150febe58553b0879f81301c5b934032ff8e3d22a1',
];

function digest(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

function denylist(): Set<string> {
  const extra = (process.env.COMPROMISED_PASSWORD_SHA256 ?? '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter((d) => /^[0-9a-f]{64}$/.test(d));
  return new Set([...BUILT_IN_DIGESTS, ...extra]);
}

export function isCompromisedPassword(password: string): boolean {
  return denylist().has(digest(password));
}
