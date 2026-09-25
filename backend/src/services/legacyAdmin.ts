import prisma from '../utils/prisma.js';

/**
 * Is this identity an admin, as the deprecated admin surfaces understand it?
 *
 * The legacy dashboard signs in through /api/admin/login and carries one of two
 * JWTs: `{ adminId }` for the master row in the Admin collection, or
 * `{ userId }` for a subadmin. Routes that said "admin only" in a comment but
 * checked only for a login use this instead, and the socket layer uses it to
 * decide who receives admin-dashboard broadcasts.
 *
 * Read fresh every call, never trusted from the token, so revoking an admin
 * takes effect immediately. `isActive` is deliberately not consulted for users:
 * the legacy socket corrupted it for months (see services/suspension.ts);
 * `suspendedAt` and `adminStatus` are the reliable signals.
 */
export async function isLegacyAdmin(identity: {
  adminId?: string | null;
  userId?: string | null;
}): Promise<boolean> {
  if (identity.adminId) {
    const admin = await prisma.admin.findUnique({
      where: { id: identity.adminId },
      select: { isActive: true },
    });
    return Boolean(admin?.isActive);
  }

  if (identity.userId) {
    const user = await prisma.user.findUnique({
      where: { id: identity.userId },
      select: { role: true, isAdmin: true, adminRole: true, adminStatus: true, suspendedAt: true },
    });
    if (!user || user.suspendedAt || user.adminStatus !== 'active') return false;
    return user.isAdmin || user.role === 'admin' || user.role === 'subadmin' || Boolean(user.adminRole);
  }

  return false;
}

/** Room every legacy-admin socket joins; admin-dashboard broadcasts go here. */
export const LEGACY_ADMIN_ROOM = 'legacy-admins';
