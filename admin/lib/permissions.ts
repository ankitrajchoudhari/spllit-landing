/**
 * Client-side mirror of the backend's role vocabulary.
 *
 * This exists to decide what to *render* — which nav items appear, which
 * buttons are disabled. It is not a security boundary and must never be
 * treated as one: the same check runs in Express middleware on every request,
 * and that is the one that decides anything. If these two ever disagree, the
 * server wins and the user sees a 403 they did not expect, which is the safe
 * direction for them to disagree in.
 */

export const ADMIN_ROLES = ['super_admin', 'admin', 'moderator', 'support', 'analyst'] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export type Permission =
  | 'dashboard.view'
  | 'users.view'
  | 'content.view'
  | 'moderation.view'
  | 'analytics.view'
  | 'audit.view'
  | 'system.view'
  | 'settings.view'
  | 'users.edit'
  | 'users.suspend'
  | 'users.delete'
  | 'content.delete'
  | 'moderation.act'
  | 'notifications.send'
  | 'settings.edit'
  | 'flags.edit'
  | 'admins.manage'
  | 'exports.run';

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  moderator: 'Moderator',
  support: 'Support',
  analyst: 'Analyst',
};

/** What the signed-in admin is, as returned by GET /me. */
export interface AdminSession {
  userId: string;
  email: string;
  name: string;
  role: AdminRole;
  roleLabel: string;
  permissions: Permission[];
}

export function can(session: AdminSession | null, permission: Permission): boolean {
  return Boolean(session?.permissions.includes(permission));
}
