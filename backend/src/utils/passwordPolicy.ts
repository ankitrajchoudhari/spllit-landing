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

/**
 * Why a password may not be set, or null when it may.
 *
 * One rule for every place an admin sets a password, so create and reset can
 * not drift apart — create previously accepted any non-empty string.
 */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string' || !password) return 'Password is required';
  if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password)) {
    return 'Password must be at least 8 characters and include both letters and numbers';
  }
  if (isCompromisedPassword(password)) return 'This password is known to be public. Choose another.';
  return null;
}
