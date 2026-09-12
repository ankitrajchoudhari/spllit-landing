import { Response, NextFunction } from 'express';

import prisma from '../utils/prisma.js';
import { AuthRequest } from '../types/express.js';
import {
  AdminRole,
  Permission,
  emailDomainAllowed,
  effectivePermissions,
  resolveAdminRole,
  roleHasPermission,
} from '../config/adminRoles.js';
import { getJsonArray } from '../services/platformSettings.js';

/**
 * Domains permitted to hold a console role, from platform settings.
 *
 * Empty by default — see emailDomainAllowed. Cached by the settings service, so
 * this is not a database read per request.
 */
async function allowedAdminDomains(): Promise<string[]> {
  return getJsonArray('security.admin_email_domains');
}

/**
 * Authorisation for the admin console.
 *
 * Separate from middleware/requireAdmin.ts on purpose. That one guards the
 * existing /api/admin-panel routes and is relied on by the shipped app; this
 * one adds per-permission gating for the console. Duplicating ~20 lines is the
 * cheaper half of the trade against editing a file the live site depends on.
 */

/** What the console knows about the caller, resolved fresh from the database. */
export interface AdminContext {
  userId: string;
  email: string;
  name: string;
  role: AdminRole;
  permissions: readonly Permission[];
}

export interface AdminRequest extends AuthRequest {
  admin?: AdminContext;
}

/**
 * Resolves the caller's console role. Runs after `identify`, which has already
 * turned either token scheme into `req.user`.
 *
 * The role is read from the database on every request rather than trusted from
 * the token, matching requireAdmin.ts: revoking someone's access has to take
 * effect immediately, not whenever their session happens to expire.
 */
export async function requireConsoleAdmin(
  req: AdminRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: {
      id: true,
      email: true,
      name: true,
      adminRole: true,
      role: true,
      isAdmin: true,
      adminStatus: true,
      isActive: true,
      adminGrants: true,
      adminRevokes: true,
    },
  });

  const role = user ? resolveAdminRole(user) : null;

  /**
   * Domain restriction, when one is configured.
   *
   * `super_admin` is exempt on purpose. This is the escape hatch: a domain list
   * entered with a typo would otherwise lock every admin — including whoever
   * needs to correct it — out of the console entirely, with the only recovery
   * being a script run against production. The same reasoning as refusing to
   * let an admin suspend their own account.
   */
  if (user && role && role !== 'super_admin') {
    const domains = await allowedAdminDomains();
    if (!emailDomainAllowed(user.email, domains)) {
      res.status(404).json({ success: false, message: 'Not found' });
      return;
    }
  }

  if (!user || !role) {
    // A 404 rather than a 403, for the same reason requireAdmin.ts uses one:
    // an unprivileged caller should not be able to confirm from the response
    // that an admin surface exists at this path.
    res.status(404).json({ success: false, message: 'Not found' });
    return;
  }

  req.admin = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role,
    /**
     * Resolved per request, not cached, and from the role *plus* this admin's
     * own grants and revokes. A permission toggled off in the console has to
     * take effect on their next request — not whenever a cache happened to
     * expire, and not on their next sign-in.
     */
    permissions: effectivePermissions(role, user!.adminGrants, user!.adminRevokes),
  };

  next();
}

/**
 * Gates a route on one capability.
 *
 * Returns 403 here, not 404: by this point the caller is a known admin, so the
 * existence of the surface is not the secret — only their authority over it
 * is. Telling them which permission they lack is what makes the message
 * actionable instead of a dead end.
 */
export function requirePermission(permission: Permission) {
  return (req: AdminRequest, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    if (!roleHasPermission(req.admin.role, permission)) {
      res.status(403).json({
        success: false,
        message: `Your role does not have permission to do this.`,
        code: 'permission_denied',
        data: { required: permission },
      });
      return;
    }

    next();
  };
}

/** Client address for the audit log, trusting Cloud Run's forwarded header. */
export function clientIp(req: AdminRequest): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    // Left-most entry is the original client; the rest are proxies.
    return forwarded.split(',')[0]!.trim();
  }
  return req.socket?.remoteAddress ?? null;
}
