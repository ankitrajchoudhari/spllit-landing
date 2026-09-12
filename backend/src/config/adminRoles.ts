/**
 * Admin console roles and permissions.
 *
 * The console needs five roles; the database has three legacy values spread
 * over `User.role`, `User.isAdmin` and `User.adminStatus`, all of which the
 * user-facing app and the legacy /api/admin routes read. Rather than change
 * what those fields mean, the console reads a new optional `User.adminRole`
 * and falls back to deriving one from the legacy fields when it is unset.
 *
 * The consequence worth stating plainly: nobody has to be migrated for the
 * console to work on day one, and nothing that reads the old fields sees a
 * value it did not see before.
 */

export const ADMIN_ROLES = [
  'super_admin',
  'admin',
  'moderator',
  'support',
  'analyst',
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && (ADMIN_ROLES as readonly string[]).includes(value);
}

/**
 * Every capability the console gates on.
 *
 * Named after what the person is doing, not the route that does it — routes
 * get renamed and merged, and a permission that tracks a URL stops describing
 * anything the moment that happens.
 */
export const PERMISSIONS = [
  // Read surfaces
  'dashboard.view',
  'users.view',
  'content.view',
  'moderation.view',
  'analytics.view',
  'audit.view',
  'system.view',
  'settings.view',

  // Write surfaces
  'users.edit',
  'users.suspend',
  'users.delete',
  'content.delete',
  'moderation.act',
  'notifications.send',
  'settings.edit',
  'flags.edit',
  'admins.manage',
  'exports.run',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Role → permissions.
 *
 * Read-only roles come first and each subsequent role is written out in full
 * rather than spreading the one below it. Inheritance chains read tidily and
 * then quietly grant something nobody intended three links down the chain;
 * being able to see a role's entire authority in one list is worth the
 * repetition.
 */
const MATRIX: Record<AdminRole, readonly Permission[]> = {
  /** Read-only, metrics only. No access to individual users or content. */
  analyst: ['dashboard.view', 'analytics.view', 'exports.run'],

  /** Handles user questions: can look, can correct, cannot punish. */
  support: [
    'dashboard.view',
    'users.view',
    'users.edit',
    'content.view',
    'moderation.view',
    'analytics.view',
  ],

  /** Acts on reports and content, but does not configure the platform. */
  moderator: [
    'dashboard.view',
    'users.view',
    'users.suspend',
    'content.view',
    'content.delete',
    'moderation.view',
    'moderation.act',
    'analytics.view',
    'audit.view',
  ],

  /** Runs the platform day to day. Cannot manage other admins. */
  admin: [
    'dashboard.view',
    'users.view',
    'users.edit',
    'users.suspend',
    'content.view',
    'content.delete',
    'moderation.view',
    'moderation.act',
    'analytics.view',
    'audit.view',
    'system.view',
    'settings.view',
    'notifications.send',
    'flags.edit',
    'exports.run',
  ],

  /** Everything, including deleting users and managing admins. */
  super_admin: [...PERMISSIONS],
};

/** Roles ordered least to most privileged — used to stop lateral escalation. */
const RANK: Record<AdminRole, number> = {
  analyst: 1,
  support: 2,
  moderator: 3,
  admin: 4,
  super_admin: 5,
};

export function permissionsFor(role: AdminRole): readonly Permission[] {
  return MATRIX[role];
}

export function roleHasPermission(role: AdminRole, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}

export function isPermission(value: unknown): value is Permission {
  return typeof value === 'string' && (PERMISSIONS as readonly string[]).includes(value);
}

/**
 * What an admin may actually do: their role, plus grants, minus revokes.
 *
 * ## Revokes win
 *
 * Applied last and unconditionally, so a permission that appears in both lists
 * is denied. Anything else would mean a toggle switched *off* in the console
 * could still leave the surface reachable, and an access control that is
 * ambiguous under contradictory input is one nobody can reason about. "Off
 * means off" is the only rule that survives contact with a hurried operator.
 *
 * ## Super admin cannot be narrowed
 *
 * A revoke against a super admin is ignored, and that is a lockout guard rather
 * than a privilege. `admins.manage` is the permission that edits these lists —
 * revoking it from the last super admin would leave an installation where
 * nobody can grant anything ever again, recoverable only by someone with
 * database access. The console refuses to build that situation.
 *
 * Grants are still meaningless there too: the role already holds everything.
 */
export function effectivePermissions(
  role: AdminRole,
  grants: readonly string[] = [],
  revokes: readonly string[] = [],
): Permission[] {
  if (role === 'super_admin') return [...PERMISSIONS];

  const effective = new Set<Permission>(MATRIX[role]);
  for (const grant of grants) {
    if (isPermission(grant)) effective.add(grant);
  }
  for (const revoke of revokes) {
    if (isPermission(revoke)) effective.delete(revoke);
  }
  return PERMISSIONS.filter((permission) => effective.has(permission));
}

export function rankOf(role: AdminRole): number {
  return RANK[role];
}

/**
 * True when `actor` is allowed to assign or modify `target`.
 *
 * Strictly greater, not greater-or-equal. Two admins of equal rank editing
 * each other is how an admin demotes the person who could undo it, and an
 * account that can rewrite its own row can promote itself to super_admin in
 * one request.
 */
export function canManageRole(actor: AdminRole, target: AdminRole): boolean {
  return RANK[actor] > RANK[target];
}

/**
 * The console role for a user row, falling back to the legacy fields.
 *
 * Returns null for anyone who should not reach the console at all, so the
 * caller has a single thing to check rather than repeating the three-way
 * legacy condition everywhere.
 */
export function resolveAdminRole(user: {
  adminRole: string | null;
  role: string;
  isAdmin: boolean;
  adminStatus: string;
  isActive: boolean;
}): AdminRole | null {
  // A deactivated account is not an admin regardless of what its role says.
  if (!user.isActive || user.adminStatus !== 'active') return null;

  if (isAdminRole(user.adminRole)) return user.adminRole;

  // Legacy derivation. Mirrors the check in middleware/requireAdmin.ts so the
  // console admits exactly the people the existing admin routes already do.
  if (user.role === 'admin') return 'super_admin';
  if (user.role === 'subadmin' || user.isAdmin) return 'admin';

  return null;
}

/**
 * Whether an address is inside the console's allowed domains.
 *
 * Spllit's own addresses are hosted on Zoho Mail, so restricting the console to
 * `spllit.app` means an admin must hold a company mailbox rather than merely a
 * Google account someone signed up with. Zoho is not doing the verifying —
 * Firebase still authenticates — but controlling the domain is what makes the
 * address meaningful, because only someone with the Zoho mailbox can complete a
 * password reset for it.
 *
 * An empty list means no restriction, which is the default: a domain rule that
 * shipped enabled would lock out every existing admin the moment it deployed.
 *
 * Subdomains are deliberately NOT matched. `spllit.app` must not admit
 * `evil.spllit.app.attacker.com`, and a suffix check is how that mistake is
 * usually made.
 */
export function emailDomainAllowed(
  email: string | null | undefined,
  domains: readonly string[],
): boolean {
  if (domains.length === 0) return true;
  if (!email) return false;

  const at = email.lastIndexOf('@');
  if (at === -1) return false;

  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain) return false;

  return domains.some((allowed) => allowed.trim().toLowerCase() === domain);
}

/** Display labels. Kept beside the matrix so a new role cannot ship unnamed. */
export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  moderator: 'Moderator',
  support: 'Support',
  analyst: 'Analyst',
};
