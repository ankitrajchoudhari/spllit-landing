/**
 * The admin console's security logic.
 *
 * Everything here is a pure function, and everything here decides something a
 * mistake in would be expensive: who may act on whom, which capabilities a role
 * carries, and what is allowed into a permanent audit row.
 *
 * The escalation cases are the point. A permission matrix that is merely wrong
 * shows up the first time somebody uses the console; a rank check that is one
 * character off — `>=` where `>` was meant — looks correct in every normal
 * interaction and only matters on the day one admin decides to demote another.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ADMIN_ROLES,
  canManageRole,
  isAdminRole,
  permissionsFor,
  rankOf,
  resolveAdminRole,
  roleHasPermission,
} from '../config/adminRoles.js';
import { diff, sanitise } from '../services/auditLog.js';
import { ADMIN_EVENTS, METRIC_FOR } from '../services/adminEvents.js';
import { markActive, markedTodayCount, resetActiveCache } from '../services/activeUsers.js';
import { bucketFor, evaluate, type FlagState } from '../services/featureFlags.js';

/** A user row as `resolveAdminRole` expects it, with nothing yet privileged. */
const ACTIVE = {
  adminRole: null as string | null,
  role: 'user',
  isAdmin: false,
  adminStatus: 'active',
  isActive: true,
};

describe('role vocabulary', () => {
  it('accepts exactly the five console roles', () => {
    for (const role of ADMIN_ROLES) assert.equal(isAdminRole(role), true);

    // The legacy values live in `User.role`, and the console reads a different
    // field precisely so those keep their old meaning. None may resolve here.
    for (const notARole of ['subadmin', 'master', 'user', '', 'SUPER_ADMIN']) {
      assert.equal(isAdminRole(notARole), false);
    }
  });

  it('gives every role a distinct rank', () => {
    const ranks = ADMIN_ROLES.map(rankOf);
    assert.equal(new Set(ranks).size, ranks.length, 'two roles share a rank');
  });
});

describe('permission matrix', () => {
  it('gives super_admin everything any other role has', () => {
    for (const role of ADMIN_ROLES) {
      for (const permission of permissionsFor(role)) {
        assert.equal(
          roleHasPermission('super_admin', permission),
          true,
          `super_admin is missing ${permission}, which ${role} has`,
        );
      }
    }
  });

  it('never lets the read-only role write, or reach an individual', () => {
    // An analyst sees aggregate metrics. Opening one person's record is
    // outside what the role exists for, never mind changing it.
    const forbidden = [
      'users.view',
      'users.edit',
      'users.suspend',
      'users.delete',
      'content.delete',
      'moderation.act',
      'settings.edit',
      'flags.edit',
      'admins.manage',
    ] as const;

    for (const permission of forbidden) {
      assert.equal(roleHasPermission('analyst', permission), false, `analyst has ${permission}`);
    }
  });

  it('lets support correct a user but never punish one', () => {
    assert.equal(roleHasPermission('support', 'users.edit'), true);
    assert.equal(roleHasPermission('support', 'users.suspend'), false);
    assert.equal(roleHasPermission('support', 'users.delete'), false);
  });

  it('lets a moderator act on people and content, but not configure the platform', () => {
    assert.equal(roleHasPermission('moderator', 'moderation.act'), true);
    assert.equal(roleHasPermission('moderator', 'users.suspend'), true);
    assert.equal(roleHasPermission('moderator', 'settings.edit'), false);
    assert.equal(roleHasPermission('moderator', 'flags.edit'), false);
  });

  it('reserves admin management and user deletion for super_admin alone', () => {
    for (const role of ADMIN_ROLES) {
      if (role === 'super_admin') continue;
      assert.equal(roleHasPermission(role, 'admins.manage'), false, `${role} can manage admins`);
      assert.equal(roleHasPermission(role, 'users.delete'), false, `${role} can delete users`);
    }
  });
});

describe('escalation guards', () => {
  it('refuses equal rank', () => {
    // The case that actually matters. With `>=`, two admins can demote each
    // other, and an account able to rewrite its own row promotes itself in one
    // request.
    for (const role of ADMIN_ROLES) {
      assert.equal(canManageRole(role, role), false, `${role} can manage its own rank`);
    }
  });

  it('refuses to let anyone act on someone above them', () => {
    assert.equal(canManageRole('moderator', 'super_admin'), false);
    assert.equal(canManageRole('admin', 'super_admin'), false);
    assert.equal(canManageRole('support', 'moderator'), false);
    assert.equal(canManageRole('analyst', 'support'), false);
  });

  it('allows acting strictly downward', () => {
    assert.equal(canManageRole('super_admin', 'admin'), true);
    assert.equal(canManageRole('admin', 'moderator'), true);
    assert.equal(canManageRole('moderator', 'support'), true);
    assert.equal(canManageRole('support', 'analyst'), true);
  });

  it('stops an admin minting a peer who could promote them back', () => {
    // Granting is checked against the *target* role as well as the person:
    // without that, `admin` creates a `super_admin` and is promoted in return.
    assert.equal(canManageRole('admin', 'admin'), false);
    assert.equal(canManageRole('admin', 'super_admin'), false);
  });
});

describe('resolving a console role', () => {
  it('prefers an explicit adminRole', () => {
    assert.equal(resolveAdminRole({ ...ACTIVE, adminRole: 'moderator' }), 'moderator');
  });

  it('falls back to the legacy fields, so existing admins keep working', () => {
    // This is what lets the console ship without a migration running first.
    assert.equal(resolveAdminRole({ ...ACTIVE, role: 'admin' }), 'super_admin');
    assert.equal(resolveAdminRole({ ...ACTIVE, role: 'subadmin' }), 'admin');
    assert.equal(resolveAdminRole({ ...ACTIVE, isAdmin: true }), 'admin');
  });

  it('gives an ordinary user no role at all', () => {
    assert.equal(resolveAdminRole(ACTIVE), null);
  });

  it('ignores an unrecognised adminRole rather than trusting it', () => {
    // The field is a plain string in MongoDB; nothing at the database level
    // stops a bad write putting anything at all in it.
    assert.equal(resolveAdminRole({ ...ACTIVE, adminRole: 'root' }), null);
    assert.equal(resolveAdminRole({ ...ACTIVE, adminRole: 'root', role: 'admin' }), 'super_admin');
  });

  it('refuses a deactivated account whatever its role says', () => {
    // Revoking access has to take effect immediately, and this is the check
    // that every console request runs.
    assert.equal(resolveAdminRole({ ...ACTIVE, adminRole: 'super_admin', isActive: false }), null);
    assert.equal(
      resolveAdminRole({ ...ACTIVE, adminRole: 'super_admin', adminStatus: 'inactive' }),
      null,
    );
    assert.equal(
      resolveAdminRole({ ...ACTIVE, adminRole: 'super_admin', adminStatus: 'deleted' }),
      null,
    );
  });
});

describe('audit redaction', () => {
  it('redacts credentials rather than dropping them', () => {
    // Dropping the key would make the row read as though the password was
    // never involved, which is a different and untrue statement.
    const out = sanitise({ password: 'hunter2', phoneHash: 'abc', name: 'Ankit' });

    assert.equal(out?.password, '[redacted]');
    assert.equal(out?.phoneHash, '[redacted]');
    assert.equal(out?.name, 'Ankit');
  });

  it('redacts every token-shaped key', () => {
    const out = sanitise({ token: 'a', accessToken: 'b', refreshToken: 'c', secret: 'd' });
    for (const [key, value] of Object.entries(out ?? {})) {
      assert.equal(value, '[redacted]', `${key} was stored in the clear`);
    }
  });

  it('truncates a long value instead of storing it whole', () => {
    const out = sanitise({ bio: 'x'.repeat(900) });
    const bio = out?.bio as string;

    assert.equal(bio.length, 501, 'expected 500 characters plus an ellipsis');
    assert.ok(bio.endsWith('…'));
  });

  it('caps the number of keys, and says that it did', () => {
    const wide = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`k${i}`, i]));
    const out = sanitise(wide);

    assert.ok(Object.keys(out ?? {}).length <= 41, 'a whole document got through');
    assert.equal(out?.['…'], 'truncated');
  });

  it('passes nothing through as null', () => {
    assert.equal(sanitise(null), null);
    assert.equal(sanitise(undefined), null);
  });
});

describe('audit diff', () => {
  it('reports only the fields that changed', () => {
    const out = diff({ isActive: true, name: 'Ankit' }, { isActive: false, name: 'Ankit' });

    assert.deepEqual(out.before, { isActive: true });
    assert.deepEqual(out.after, { isActive: false });
  });

  it('records nothing when a patch changes nothing', () => {
    // A no-op write must not produce a row claiming something happened.
    const out = diff({ status: 'published' }, { status: 'published' });

    assert.deepEqual(out.before, {});
    assert.deepEqual(out.after, {});
  });

  it('treats a value appearing where there was none as a change', () => {
    const out = diff({ adminRole: null }, { adminRole: 'moderator' });

    assert.deepEqual(out.before, { adminRole: null });
    assert.deepEqual(out.after, { adminRole: 'moderator' });
  });

  it('compares by value, not by identity', () => {
    // Composite fields would otherwise report a change on every single write.
    const out = diff({ venue: { lat: 1, lng: 2 } }, { venue: { lat: 1, lng: 2 } });
    assert.deepEqual(out.after, {});
  });
});

describe('realtime event catalogue', () => {
  it('gives every event a metric key', () => {
    // An event added without one would increment a counter literally named
    // `undefined`, and the dashboard figure it feeds would silently stop
    // moving with nothing failing anywhere.
    for (const event of ADMIN_EVENTS) {
      const metric = METRIC_FOR[event];
      assert.equal(typeof metric, 'string', `${event} has no metric`);
      assert.ok(metric.length > 0, `${event} has an empty metric`);
    }
  });

  it('gives every event a distinct metric key', () => {
    const metrics = ADMIN_EVENTS.map((event) => METRIC_FOR[event]);
    assert.equal(new Set(metrics).size, metrics.length, 'two events share a metric');
  });

  it('names every metric in dotted form', () => {
    // The rollup id is `<metric>:<day>`, so a metric containing a colon would
    // produce ambiguous keys that collide across different days.
    for (const metric of Object.values(METRIC_FOR)) {
      assert.ok(/^[a-z]+\.[a-z_]+$/.test(metric), `${metric} is not a dotted lowercase key`);
      assert.ok(!metric.includes(':'), `${metric} would break the rollup id`);
    }
  });
});

describe('active-user marking', () => {
  it('records a user only once per day, however many requests they make', () => {
    // The whole point of the in-memory set: this runs on every authenticated
    // request, and a write per request would be the most expensive thing in
    // the application.
    resetActiveCache();
    assert.equal(markedTodayCount(), 0);

    for (let i = 0; i < 50; i += 1) markActive('user-a');

    assert.equal(markedTodayCount(), 1);
  });

  it('counts distinct users separately', () => {
    resetActiveCache();

    markActive('user-a');
    markActive('user-b');
    markActive('user-a');

    assert.equal(markedTodayCount(), 2);
  });

  it('ignores an absent user rather than recording a null row', () => {
    resetActiveCache();

    markActive(null);
    markActive(undefined);
    markActive('');

    assert.equal(markedTodayCount(), 0);
  });
});

/** A flag with everything permissive, narrowed per test. */
const FLAG: FlagState = {
  key: 'rides.enabled',
  enabled: true,
  rolloutPercentage: 100,
  targetUserIds: [],
  environments: [],
};

describe('feature flag evaluation', () => {
  it('is off when the flag does not exist', () => {
    // An unknown key must not read as on, or a typo enables something.
    assert.equal(evaluate(undefined, 'user-a', 'production'), false);
  });

  it('is off for everyone when disabled, targets included', () => {
    // Off is off. A rollout percentage on a disabled flag is not a partial
    // state, and a targeted user must not slip through it.
    const flag = { ...FLAG, enabled: false, rolloutPercentage: 100, targetUserIds: ['user-a'] };

    assert.equal(evaluate(flag, 'user-a', 'production'), false);
    assert.equal(evaluate(flag, 'user-b', 'production'), false);
  });

  it('narrows by environment only when environments are listed', () => {
    assert.equal(evaluate(FLAG, 'user-a', 'production'), true);

    const staged = { ...FLAG, environments: ['development'] };
    assert.equal(evaluate(staged, 'user-a', 'development'), true);
    assert.equal(evaluate(staged, 'user-a', 'production'), false);
  });

  it('lets a targeted user bypass the percentage', () => {
    // This is what makes it possible to check a 1% rollout before widening it.
    const flag = { ...FLAG, rolloutPercentage: 0, targetUserIds: ['user-a'] };

    assert.equal(evaluate(flag, 'user-a', 'production'), true);
    assert.equal(evaluate(flag, 'user-b', 'production'), false);
  });

  it('is off for an anonymous caller on a partial rollout', () => {
    // Nobody to bucket stably, so a coin flip per request is the wrong answer.
    const flag = { ...FLAG, rolloutPercentage: 50 };

    assert.equal(evaluate(flag, null, 'production'), false);
    // A full rollout still applies — there is nothing to bucket.
    assert.equal(evaluate({ ...FLAG, rolloutPercentage: 100 }, null, 'production'), true);
  });

  it('keeps a user on the same side of a rollout every time', () => {
    // The property that matters most. A random draw per call would flicker
    // people between variants mid-session.
    const flag = { ...FLAG, rolloutPercentage: 50 };
    const first = evaluate(flag, 'user-a', 'production');

    for (let i = 0; i < 100; i += 1) {
      assert.equal(evaluate(flag, 'user-a', 'production'), first);
    }
  });

  it('widening a rollout never removes anyone already inside it', () => {
    // Monotonicity. If raising 20% to 40% could evict someone, a gradual
    // rollout would take features away from users who already had them.
    const ids = Array.from({ length: 300 }, (_, i) => `user-${i}`);

    for (const id of ids) {
      if (evaluate({ ...FLAG, rolloutPercentage: 20 }, id, 'production')) {
        assert.equal(
          evaluate({ ...FLAG, rolloutPercentage: 40 }, id, 'production'),
          true,
          `${id} was inside 20% but not 40%`,
        );
      }
    }
  });

  it('buckets differently per flag, so one cohort does not get everything', () => {
    // Hashing the user id alone would put the same people in every rollout.
    const ids = Array.from({ length: 200 }, (_, i) => `user-${i}`);
    const differing = ids.filter(
      (id) => bucketFor('flag.one', id) !== bucketFor('flag.two', id),
    );

    assert.ok(differing.length > 150, `only ${differing.length}/200 buckets differed`);
  });

  it('spreads buckets across the range', () => {
    // A hash that clustered would make "20%" mean something other than 20%.
    const ids = Array.from({ length: 1000 }, (_, i) => `user-${i}`);
    const inside = ids.filter((id) => bucketFor(FLAG.key, id) < 50).length;

    // Generous bounds: this asserts the distribution is not badly skewed, not
    // that a hash is perfectly uniform.
    assert.ok(inside > 400 && inside < 600, `expected roughly half, got ${inside}/1000`);
  });
});
