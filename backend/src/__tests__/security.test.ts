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
