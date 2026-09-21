import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LEGACY_ALIASES,
  normaliseStatus,
  statusesAllowing,
  TRANSITIONS,
} from '../services/rideLifecycle.js';

/**
 * The ride state machine, and the set the stale sweep is built from.
 *
 * `statusesAllowing` is the reason this file exists. services/staleSweep.ts
 * cancels rides whose departure passed months ago, and it asks this function
 * which statuses it is allowed to touch rather than carrying its own list. That
 * makes the function load-bearing on real user data: if it returned a status
 * the machine forbids, a background job would rewrite rows in a way no user
 * could, and nothing in the request path would ever notice.
 */

describe('normaliseStatus', () => {
  it('folds the legacy aliases onto their modern names', () => {
    assert.equal(normaliseStatus('pending'), 'requested');
    assert.equal(normaliseStatus('matched'), 'accepted');
  });

  it('leaves a status the machine already knows alone', () => {
    for (const status of Object.keys(TRANSITIONS)) {
      assert.equal(normaliseStatus(status), status);
    }
  });

  it('passes through anything unrecognised rather than guessing', () => {
    // A status invented by a future migration must not silently become
    // `requested` — the transition check should reject it instead.
    assert.equal(normaliseStatus('archived'), 'archived');
  });
});

describe('statusesAllowing', () => {
  const cancellable = statusesAllowing('cancelled');

  it('returns every open state, aliases included', () => {
    assert.deepEqual(
      [...cancellable].sort(),
      ['accepted', 'arriving', 'matched', 'pending', 'requested'],
    );
  });

  /**
   * The aliases are the half that is easy to lose, and losing them is not a
   * rounding error: twelve of the twenty-one stale rides in production are
   * stored as `matched`. A sweep built from canonical names alone would skip
   * the majority of the rows it exists to fix, and would look like it worked.
   */
  it('includes an alias exactly when its canonical name qualifies', () => {
    for (const [alias, canonical] of Object.entries(LEGACY_ALIASES)) {
      assert.equal(
        cancellable.includes(alias),
        cancellable.includes(canonical),
        `${alias} and ${canonical} must agree`,
      );
    }
  });

  it('never offers a move the machine forbids', () => {
    for (const from of cancellable) {
      assert.ok(
        TRANSITIONS[normaliseStatus(from)].includes('cancelled'),
        `${from} cannot legally be cancelled`,
      );
    }
  });

  /**
   * The exclusion the sweep depends on. A ride that started can only be
   * completed, and completing it would assert that the trip happened — which
   * no cleanup job is in a position to know.
   */
  it('excludes in_progress and the terminal states', () => {
    for (const status of ['in_progress', 'completed', 'cancelled']) {
      assert.ok(!cancellable.includes(status), `${status} must not be cancellable`);
    }
  });

  it('derives the other moves in the machine too', () => {
    assert.deepEqual([...statusesAllowing('completed')].sort(), ['in_progress']);
    assert.deepEqual([...statusesAllowing('accepted')].sort(), ['pending', 'requested']);
    assert.deepEqual([...statusesAllowing('nonsense')].sort(), []);
  });
});
