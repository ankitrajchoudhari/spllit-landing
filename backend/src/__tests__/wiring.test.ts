import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';

/**
 * Route wiring.
 *
 * Every request here is unauthenticated, which is the point: `identify` rejects
 * on the missing Authorization header before it touches Prisma, so this suite
 * proves the whole routing table without a database.
 *
 * What a 401 tells us that a 404 does not:
 *   - the router is actually mounted,
 *   - the path matched the handler we meant,
 *   - and the handler is behind auth.
 *
 * A 404 here means a route silently went missing; a 200 means something is
 * reachable by anyone.
 */

let baseUrl = '';
let server: Server;

before(async () => {
  /**
   * The flag must be set before server.js is evaluated, and ESM hoists every
   * static import above module-body statements — a top-level assignment ran
   * *after* the import and the server bound 3001 anyway. A dynamic import is
   * the only ordering that actually holds.
   */
  process.env.SPLLIT_NO_LISTEN = '1';
  const { app } = (await import('../server.js')) as { app: Express };

  await new Promise<void>((resolve) => {
    // Port 0: the OS picks a free one, so the suite never collides with a dev
    // server already holding 3001.
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function call(method: string, path: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(method === 'GET' || method === 'DELETE' ? {} : { body: '{}' }),
  });
  return response.status;
}

/** Mounted, matched, and gated. */
async function expectGated(method: string, path: string) {
  const status = await call(method, path);
  assert.notEqual(status, 404, `${method} ${path} is not mounted`);
  assert.ok(
    status === 401 || status === 403,
    `${method} ${path} should require auth, got ${status}`,
  );
}

describe('health', () => {
  it('responds without auth', async () => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { status?: string };
    assert.equal(body.status, 'ok');
  });
});

describe('ride matching routes', () => {
  it('mounts the corridor search', () => expectGated('GET', '/api/rides/search'));
  it('mounts companions', () => expectGated('GET', '/api/rides/companions'));
  it('mounts nearby', () => expectGated('GET', '/api/rides/nearby'));
  it('mounts mine', () => expectGated('GET', '/api/rides/mine'));
  it('mounts candidates', () => expectGated('GET', '/api/rides/abc123/candidates'));
  it('mounts invite', () => expectGated('POST', '/api/rides/abc123/invite'));

  it('matches /search before the legacy /:id catch-all', async () => {
    // Both routers are mounted on /api/rides. If ordering regressed, /search
    // would be read as a ride id and answer differently.
    assert.equal(await call('GET', '/api/rides/search'), 401);
  });
});

describe('trip request + invite routes', () => {
  it('mounts publish', () => expectGated('POST', '/api/trips/requests'));
  it('mounts mine', () => expectGated('GET', '/api/trips/requests/mine'));
  it('mounts withdraw', () => expectGated('DELETE', '/api/trips/requests/abc'));
  it('mounts invites', () => expectGated('GET', '/api/trips/invites'));
  it('mounts accept', () => expectGated('POST', '/api/trips/invites/abc/accept'));
  it('mounts decline', () => expectGated('POST', '/api/trips/invites/abc/decline'));
});

describe('host routes', () => {
  it('mounts the vehicle catalogue', () => expectGated('GET', '/api/host/catalogue'));
  it('mounts the host profile', () => expectGated('GET', '/api/host/me'));
  it('mounts profile save', () => expectGated('POST', '/api/host/me'));
  it('mounts vehicle registration', () => expectGated('POST', '/api/host/vehicles'));
  it('mounts primary selection', () => expectGated('POST', '/api/host/vehicles/abc/primary'));
  it('mounts vehicle removal', () => expectGated('DELETE', '/api/host/vehicles/abc'));
});

describe('squad routes', () => {
  it('mounts nearby', () => expectGated('GET', '/api/squads/nearby'));
  it('mounts mine', () => expectGated('GET', '/api/squads/mine'));
  it('mounts detail', () => expectGated('GET', '/api/squads/abc'));
  it('mounts create', () => expectGated('POST', '/api/squads'));
  it('mounts meeting point', () => expectGated('PATCH', '/api/squads/abc/meeting-point'));

  // The member router is mounted first precisely so these beat `/:id`.
  it('mounts join-by-code', () => expectGated('POST', '/api/squads/join-by-code'));
  it('mounts join requests', () => expectGated('GET', '/api/squads/abc/requests'));
  it('mounts request decisions', () => expectGated('POST', '/api/squads/abc/requests/m1'));
  it('mounts role changes', () => expectGated('PATCH', '/api/squads/abc/members/u1'));
  it('mounts member removal', () => expectGated('DELETE', '/api/squads/abc/members/u1'));
  it('mounts position reporting', () => expectGated('POST', '/api/squads/abc/position'));
  it('mounts progress', () => expectGated('GET', '/api/squads/abc/progress'));
  it('mounts the payment status', () => expectGated('GET', '/api/squads/abc/payment'));
  it('mounts the payment order', () => expectGated('POST', '/api/squads/abc/payment/order'));
  it('mounts payment verification', () => expectGated('POST', '/api/squads/abc/payment/verify'));
  it('mounts the end-squad transition', () => expectGated('PATCH', '/api/squads/abc/status'));

  /**
   * `/:id/payment` is two segments and sits on the same prefix as the squad
   * router's `/:id`. If the payment router were mounted second, "payment" would
   * be read as part of a squad id and never reach its handler.
   */
  it('routes /:id/payment to the payment router, not to /:id', async () => {
    const response = await fetch(`${baseUrl}/api/squads/abc/payment`);
    const body = (await response.json()) as { success?: boolean };
    assert.equal(response.status, 401);
    assert.equal(body.success, false);
  });

  it('routes join-by-code to its handler, not to /:id', async () => {
    // If squadRoutes were mounted first, this would be parsed as squad id
    // "join-by-code" on a GET-only path and answer 404 instead of 401.
    assert.equal(await call('POST', '/api/squads/join-by-code'), 401);
  });
});

describe('admin routes', () => {
  it('gates the vehicle queue', () => expectGated('GET', '/api/admin-panel/vehicles'));
  it('gates vehicle decisions', () => expectGated('PATCH', '/api/admin-panel/vehicles/abc'));
  it('gates the overview', () => expectGated('GET', '/api/admin-panel/overview'));
});

describe('user routes', () => {
  it('mounts the platform profile', () => expectGated('GET', '/api/users/me/profile'));
  it('mounts username availability', () => expectGated('GET', '/api/users/username-available'));
  it('mounts nearby', () => expectGated('GET', '/api/users/nearby'));

  it('matches /username-available before the legacy /:id', async () => {
    assert.equal(await call('GET', '/api/users/username-available?username=abc'), 401);
  });

  it('mounts the migrated profile-by-id', () => expectGated('GET', '/api/users/abc123'));
  it('mounts the leaderboard', () => expectGated('GET', '/api/users/leaderboard'));
  it('mounts the invite summary', () => expectGated('GET', '/api/users/me/invites'));

  /**
   * `/leaderboard` is a single segment, so it is one declaration-order mistake
   * away from being read as a user id. The rejection body is what distinguishes
   * them: the platform router gates with identify ({ success, message }).
   */
  it('matches /leaderboard before the profile-by-id catch-all', async () => {
    const response = await fetch(`${baseUrl}/api/users/leaderboard`);
    const body = (await response.json()) as { success?: boolean; error?: string };
    assert.equal(body.success, false);
    assert.equal(body.error, undefined, '/leaderboard was parsed as a user id');
  });

  /**
   * GET /api/users/:id moved from the legacy router to usersPlatform. The two
   * gate with different middleware, and their rejection bodies are how you tell
   * which one answered: `identify` returns { success, message }, the legacy
   * `authenticate` returns { error }. Asserting the platform shape here is what
   * proves the migration actually took effect — a status code alone cannot,
   * since both routers reject with 401.
   */
  it('serves profile-by-id from the platform router, not the legacy one', async () => {
    const response = await fetch(`${baseUrl}/api/users/abc123`);
    assert.equal(response.status, 401);

    const body = (await response.json()) as { success?: boolean; error?: string };
    assert.equal(body.success, false, 'expected identify to reject, not legacy authenticate');
    assert.equal(body.error, undefined, 'legacy authenticate answered — /:id is still on users.ts');
  });
});

/**
 * The AI routes are gated like everything else, and that matters more here than
 * elsewhere: every call behind them costs money to a metered third party. An
 * endpoint left open would be someone else's model budget, spendable by anyone
 * who found the path.
 */
describe('ai routes', () => {
  it('gates the squad-draft extractor', async () => {
    await expectGated('POST', '/api/ai/squad-draft');
  });

  it('gates the availability probe', async () => {
    await expectGated('GET', '/api/ai/status');
  });
});

describe('unknown routes', () => {
  it('does not answer a path nobody defined', async () => {
    assert.equal(await call('GET', '/api/definitely-not-a-route'), 404);
  });
});

describe('scheduled maintenance', () => {
  /**
   * Fail-closed, and silent about it.
   *
   * MAINTENANCE_KEY is unset in this suite, which is the same state a fresh
   * install is in. The route must behave as though it does not exist — a
   * maintenance endpoint left open because a secret was forgotten is worse
   * than one that is broken, because nothing tells you about it.
   *
   * 404 rather than 401 on purpose: an unauthenticated caller should not be
   * able to confirm from the response that something privileged lives here.
   */
  it('does not exist without a maintenance key', async () => {
    const response = await fetch(`${baseUrl}/api/maintenance/sweep-chats`, { method: 'POST' });
    assert.equal(response.status, 404);
  });

  it('does not exist for a wrong key either', async () => {
    const response = await fetch(`${baseUrl}/api/maintenance/sweep-chats`, {
      method: 'POST',
      headers: { 'x-maintenance-key': 'not-the-key' },
    });
    assert.equal(response.status, 404);
  });
});

describe('maintenance sweeps are all gated', () => {
  // Every route on this router must fail closed, not just the first one
  // written. A new sweep added without its guard is the failure this catches.
  for (const path of ['sweep-chats', 'sweep-notifications', 'sweep']) {
    it(`${path} does not exist without a key`, async () => {
      const response = await fetch(`${baseUrl}/api/maintenance/${path}`, { method: 'POST' });
      assert.equal(response.status, 404);
    });
  }
});
