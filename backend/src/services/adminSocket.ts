import { Server, Socket, Namespace } from 'socket.io';

import prisma from '../utils/prisma.js';
import { verifyAccessToken } from '../utils/helpers.js';
import { verifyFirebaseIdToken, isFirebaseAdminConfigured } from '../utils/firebaseAdmin.js';
import { resolveFirebaseUser } from './firebaseIdentity.js';
import { resolveAdminRole, type AdminRole } from '../config/adminRoles.js';

/**
 * The console's realtime channel.
 *
 * A dedicated Socket.IO namespace rather than a room on the default one. That
 * is the whole design decision here: `services/live.ts` owns the default
 * namespace and carries every user's positions, presence and chat, and adding
 * an admin room to it would mean editing the file the live map depends on and
 * putting admin fan-out one bad `broadcast.emit` away from every user's phone.
 *
 * A namespace is isolated by construction. `io.of('/admin')` cannot receive the
 * default namespace's broadcasts and vice versa, so the blast radius of a
 * mistake in here stops at the console.
 */

const NAMESPACE = '/admin';

interface AdminSocket extends Socket {
  adminId?: string;
  adminRole?: AdminRole;
}

let namespaceRef: Namespace | null = null;

/**
 * Resolves a token to an admin, or null.
 *
 * The same dual-scheme resolution the HTTP middleware uses — backend JWT first
 * because it is the cheaper local verification, Firebase second — followed by
 * the same database role read. Deliberately *not* trusting a role claim from
 * the token: a socket can stay open for hours, and revoking someone must take
 * effect on their next room join rather than whenever they reconnect.
 */
async function resolveAdmin(
  token: string | undefined,
): Promise<{ id: string; role: AdminRole } | null> {
  if (!token) return null;

  let userId: string | null = null;

  try {
    userId = verifyAccessToken(token).userId;
  } catch {
    // Not a backend JWT — fall through to Firebase.
  }

  if (!userId && isFirebaseAdminConfigured()) {
    try {
      const decoded = await verifyFirebaseIdToken(token);
      // Verified email only — an unverified sign-up with an admin's address
      // used to resolve to that admin here.
      const user = await resolveFirebaseUser(decoded);
      userId = user?.id ?? null;
    } catch {
      return null;
    }
  }

  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      adminRole: true,
      role: true,
      isAdmin: true,
      adminStatus: true,
      isActive: true,
    },
  });

  if (!user) return null;

  const role = resolveAdminRole(user);
  return role ? { id: user.id, role } : null;
}

export function setupAdminNamespace(io: Server): void {
  const admin = io.of(NAMESPACE);
  namespaceRef = admin;

  /**
   * Authentication is a connection gate, not a room gate.
   *
   * `live.ts` lets unauthenticated sockets connect and simply refuses their
   * room joins, because a public map still has something to show them. There is
   * no equivalent here: nothing in this namespace is public, so a caller who is
   * not an admin is refused the handshake outright.
   */
  admin.use(async (socket: AdminSocket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    const resolved = await resolveAdmin(token);

    if (!resolved) {
      next(new Error('unauthorised'));
      return;
    }

    socket.adminId = resolved.id;
    socket.adminRole = resolved.role;
    next();
  });

  admin.on('connection', (socket: AdminSocket) => {
    // Everyone who gets this far is a verified admin, so the metrics room is
    // joined on connect rather than on request. There is nothing to opt into.
    socket.join('metrics');

    socket.emit('ready', {
      role: socket.adminRole,
      serverTime: Date.now(),
    });
  });
}

/**
 * Fans an event out to every connected admin.
 *
 * Never throws and never awaits: this is called from the write path of ordinary
 * user actions, and a socket problem must not fail the signup or the ride that
 * triggered it.
 */
export function emitToAdmins(event: string, payload: unknown): void {
  try {
    namespaceRef?.to('metrics').emit(event, payload);
  } catch (error) {
    console.error('[adminSocket/emit]', error);
  }
}

/** How many admins are watching. Reported on the console's system page. */
export function connectedAdminCount(): number {
  return namespaceRef?.sockets.size ?? 0;
}
