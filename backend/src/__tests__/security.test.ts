/**
 * Regression tests for the 2026-09-26 security audit.
 *
 * Each block pins one finding so a later edit cannot quietly reopen it. They
 * test the decision each fix hinges on, as a pure function, because the routes
 * around them need a live database.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { isCompromisedPassword } from '../utils/passwordPolicy.js';

describe('C1 — leaked master-admin password', () => {
  it('refuses the password that was committed to the repo', () => {
    assert.equal(isCompromisedPassword('Kurkure123@'), true);
  });

  it('is exact, not a prefix or case-insensitive match', () => {
    assert.equal(isCompromisedPassword('kurkure123@'), false);
    assert.equal(isCompromisedPassword('Kurkure123@!'), false);
    assert.equal(isCompromisedPassword(''), false);
  });

  it('accepts extra digests from the environment and ignores malformed ones', () => {
    const before = process.env.COMPROMISED_PASSWORD_SHA256;
    // sha256('hunter2')
    process.env.COMPROMISED_PASSWORD_SHA256 =
      'not-a-digest, f52fbd32b2b3b86ff88ef6c490628285f482af15ddcb29541f94bcf526a3f6c7';
    try {
      assert.equal(isCompromisedPassword('hunter2'), true);
    } finally {
      if (before === undefined) delete process.env.COMPROMISED_PASSWORD_SHA256;
      else process.env.COMPROMISED_PASSWORD_SHA256 = before;
    }
    assert.equal(isCompromisedPassword('hunter2'), false);
  });
});

describe('C2 — socket room joins', async () => {
  const { parseRoom, positionRoom } = await import('../services/live.js');

  it('accepts only the four known room kinds', () => {
    assert.deepEqual(parseRoom('thread:65f0a1b2c3d4e5f601234567'), {
      kind: 'thread',
      id: '65f0a1b2c3d4e5f601234567',
    });
    assert.equal(parseRoom('admin:all'), null);
    assert.equal(parseRoom('position:abc'), null, 'the position feed is never joined by name');
    assert.equal(parseRoom('user:'), null);
    assert.equal(parseRoom('user:a:b'), null);
    assert.equal(parseRoom(42), null);
    assert.equal(parseRoom('thread:' + 'a'.repeat(200)), null);
  });

  it('keeps the position feed apart from the private user room', () => {
    assert.notEqual(positionRoom('u1'), 'user:u1');
  });
});

describe('C3 — one password rule for admin create and reset', async () => {
  const { passwordProblem } = await import('../utils/passwordPolicy.js');

  it('rejects weak, missing and leaked passwords', () => {
    assert.ok(passwordProblem(undefined));
    assert.ok(passwordProblem('short1'));
    assert.ok(passwordProblem('lettersonly'));
    assert.ok(passwordProblem('Kurkure123@'));
  });

  it('accepts a password with letters and digits, 8+ long', () => {
    assert.equal(passwordProblem('correct horse 42'), null);
  });
});

describe('C4 — email is only an identity once it is verified', async () => {
  const { linkableEmail, mustDropPassword } = await import('../services/firebaseIdentity.js');

  it('never links on an unverified or missing email claim', () => {
    assert.equal(linkableEmail({ uid: 'u', email: 'victim@x.com' }), null);
    assert.equal(linkableEmail({ uid: 'u', email: 'victim@x.com', email_verified: false }), null);
    assert.equal(linkableEmail({ uid: 'u', email_verified: true }), null);
  });

  it('links on a verified claim, normalised', () => {
    assert.equal(linkableEmail({ uid: 'u', email: ' Owner@X.com ', email_verified: true }), 'owner@x.com');
  });

  it('drops only a password nobody proved the mailbox for', () => {
    const squat = { firebaseUid: null, emailVerified: false, password: 'hash' };
    assert.equal(mustDropPassword(squat), true);
    assert.equal(mustDropPassword({ ...squat, emailVerified: true }), false, 'verified legacy account');
    assert.equal(mustDropPassword({ ...squat, firebaseUid: 'uid' }), false, 'already linked');
    assert.equal(mustDropPassword({ ...squat, password: null }), false, 'no password to drop');
  });
});

describe('H2 — suspension has one meaning', async () => {
  const { suspensionPatch } = await import('../services/suspension.js');

  it('suspending stamps suspendedAt; restoring clears it', () => {
    const suspend = suspensionPatch(false);
    assert.equal(suspend.isActive, false);
    assert.ok(suspend.suspendedAt instanceof Date);
    assert.deepEqual(suspensionPatch(true), { isActive: true, suspendedAt: null });
  });
});
