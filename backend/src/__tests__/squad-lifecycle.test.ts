import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  evaluateLifecycle,
  LIFECYCLE,
  type LifecycleMember,
  type LifecycleSquad,
} from '../services/squadLifecycle.js';

/**
 * The lifecycle rules, as fixtures.
 *
 * `evaluateLifecycle` is pure on purpose — it takes a squad, its members and
 * the current time, and returns what the status should be. No database, no
 * clock, no network. That is what makes the expiry arithmetic and the arrival
 * quorum testable exhaustively rather than by waiting four hours.
 *
 * See docs/SQUAD-LIFECYCLE.md.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** 09:00 on an arbitrary day. Every case is expressed relative to this. */
const MEETING = new Date('2026-08-14T09:00:00.000Z');
const at = (offsetMs: number) => new Date(MEETING.getTime() + offsetMs);

const squad = (over: Partial<LifecycleSquad> = {}): LifecycleSquad => ({
  status: 'active',
  meetingAt: MEETING,
  durationMinutes: 45,
  lastActivityAt: MEETING,
  // An hour before the meeting, so it is never accidentally the thing under
  // test in the scheduled cases — those all anchor on MEETING.
  createdAt: new Date(MEETING.getTime() - 60 * 60 * 1000),
  ...over,
});

/** A member who shared location and reached the point. */
const arrived = (locationAt = MEETING): LifecycleMember => ({
  status: 'arrived',
  locationAt,
});

/** Sharing location, still on the way. */
const travelling = (locationAt = MEETING): LifecycleMember => ({
  status: 'travelling',
  locationAt,
});

/** In the squad, but has never reported a position — denied permission. */
const noLocation = (): LifecycleMember => ({ status: 'active', locationAt: null });

describe('squad lifecycle — scheduled to in-progress', () => {
  it('stays active while the meeting time is still ahead', () => {
    const decision = evaluateLifecycle(squad(), [arrived(), arrived()], at(-MINUTE));
    assert.equal(decision.status, 'active');
    assert.equal(decision.changed, false);
  });

  it('moves to in_progress the moment the meeting time passes', () => {
    const decision = evaluateLifecycle(squad(), [travelling(), travelling()], at(MINUTE));
    assert.equal(decision.status, 'in_progress');
    assert.equal(decision.changed, true);
  });

  it('stays active while an unscheduled squad is inside its window', () => {
    // No meeting time means it was made to happen now, so creation is the
    // clock. Nothing is backfilled into meetingAt.
    const created = at(0);
    const decision = evaluateLifecycle(
      squad({ meetingAt: null, lastActivityAt: null, createdAt: created }),
      [travelling(), travelling()],
      new Date(created.getTime() + (LIFECYCLE.UNSCHEDULED_MAX_HOURS - 1) * HOUR),
    );
    assert.equal(decision.status, 'active');
    assert.equal(decision.changed, false);
  });

  it('closes an unscheduled squad once its window from creation has passed', () => {
    /**
     * The gap this covers: a squad with no meeting time previously had no
     * expiry at all and could only be closed by hand, so one created by mistake
     * stayed live, discoverable and joinable indefinitely.
     */
    const created = at(0);
    const decision = evaluateLifecycle(
      squad({ meetingAt: null, lastActivityAt: null, createdAt: created }),
      [travelling(), travelling()],
      new Date(created.getTime() + LIFECYCLE.UNSCHEDULED_MAX_HOURS * HOUR + MINUTE),
    );
    assert.equal(decision.status, 'completed');
    assert.equal(decision.reason, 'unscheduled-expiry');
    assert.equal(decision.changed, true);
  });

  it('lets arrival end an unscheduled squad before its window is up', () => {
    // Everyone reaching the point ends the squad whether or not anybody wrote
    // down a time.
    const created = at(0);
    const decision = evaluateLifecycle(
      squad({ meetingAt: null, lastActivityAt: null, createdAt: created }),
      [arrived(), arrived()],
      new Date(created.getTime() + HOUR),
    );
    assert.equal(decision.status, 'completed');
    assert.equal(decision.reason, 'arrival-quorum');
  });

  it('does not let a single arrival close an unscheduled squad', () => {
    // Same quorum rule as the scheduled path: one person reaching the point
    // says nothing about anyone else.
    const created = at(0);
    const decision = evaluateLifecycle(
      squad({ meetingAt: null, lastActivityAt: null, createdAt: created }),
      [arrived(), noLocation()],
      new Date(created.getTime() + HOUR),
    );
    assert.equal(decision.status, 'active');
  });
});

describe('squad lifecycle — arrival quorum', () => {
  it('completes once everyone who shared location has arrived', () => {
    const decision = evaluateLifecycle(squad(), [arrived(), arrived()], at(20 * MINUTE));
    assert.equal(decision.status, 'completed');
    assert.equal(decision.reason, 'arrival-quorum');
  });

  it('waits while one of them is still travelling', () => {
    const decision = evaluateLifecycle(
      squad(),
      [arrived(), arrived(), travelling()],
      at(20 * MINUTE),
    );
    assert.equal(decision.status, 'in_progress');
  });

  it('ignores a member who never shared location', () => {
    // The common case, not the rare one: denying permission leaves lat/lng
    // null, so this member can never be `arrived` and must not hold the
    // squad open on its own.
    const decision = evaluateLifecycle(
      squad(),
      [arrived(), arrived(), noLocation()],
      at(20 * MINUTE),
    );
    assert.equal(decision.status, 'completed');
    assert.equal(decision.reason, 'arrival-quorum');
  });

  it('does not complete when nobody has usable location', () => {
    const decision = evaluateLifecycle(
      squad(),
      [noLocation(), noLocation(), noLocation()],
      at(20 * MINUTE),
    );
    assert.equal(decision.status, 'in_progress');
  });

  it('does not complete a squad on one arrival alone', () => {
    // A lone leader reaching the point would otherwise end the squad the
    // instant they got there, which reads as the app cancelling their plan.
    const decision = evaluateLifecycle(squad(), [arrived(), noLocation()], at(20 * MINUTE));
    assert.equal(decision.status, 'in_progress');
  });

  it('excludes pending and departed members from the quorum', () => {
    // A join request nobody approved, and someone who walked away, must not
    // hold a squad open.
    const decision = evaluateLifecycle(
      squad(),
      [
        arrived(),
        arrived(),
        { status: 'pending', locationAt: MEETING },
        { status: 'left', locationAt: MEETING },
      ],
      at(20 * MINUTE),
    );
    assert.equal(decision.status, 'completed');
  });
});

describe('squad lifecycle — expiry', () => {
  // meetingAt 9:00 + 45 min duration = 9:45 expected end.
  // soft expiry = 9:45 + 90 min = 11:15. hard = 9:00 + 4 h = 13:00.
  const soft = 135 * MINUTE;
  const hard = 4 * HOUR;

  it('keeps a squad alive past soft expiry while it is still being used', () => {
    const decision = evaluateLifecycle(
      squad({ lastActivityAt: at(soft - 5 * MINUTE) }),
      [travelling(), travelling()],
      at(soft + MINUTE),
    );
    assert.equal(decision.status, 'in_progress');
  });

  it('completes once it has been quiet past soft expiry', () => {
    const decision = evaluateLifecycle(
      squad({ lastActivityAt: at(soft - 31 * MINUTE) }),
      [travelling(), travelling()],
      at(soft + MINUTE),
    );
    assert.equal(decision.status, 'completed');
    assert.equal(decision.reason, 'quiet');
  });

  it('completes at the hard ceiling even while positions keep arriving', () => {
    // A phone left in a pocket reporting forever must not keep a squad open
    // overnight. This is the backstop the quietness rule cannot provide.
    const decision = evaluateLifecycle(
      squad({ lastActivityAt: at(hard) }),
      [travelling(at(hard)), travelling(at(hard))],
      at(hard + MINUTE),
    );
    assert.equal(decision.status, 'completed');
    assert.equal(decision.reason, 'hard-expiry');
  });

  it('applies the default duration when none was given', () => {
    // Same soft expiry as the explicit 45, since 45 is the default.
    const withDefault = squad({ durationMinutes: null, lastActivityAt: at(soft - 31 * MINUTE) });
    assert.equal(
      evaluateLifecycle(withDefault, [travelling()], at(soft - MINUTE)).status,
      'in_progress',
    );
    assert.equal(
      evaluateLifecycle(withDefault, [travelling()], at(soft + MINUTE)).status,
      'completed',
    );
  });

  it('treats a squad with no recorded activity as quiet since the meeting time', () => {
    const decision = evaluateLifecycle(
      squad({ lastActivityAt: null }),
      [travelling()],
      at(soft + MINUTE),
    );
    assert.equal(decision.status, 'completed');
  });

  it('counts a position report as activity in its own right', () => {
    // Somebody still navigating keeps the squad alive even when nothing else
    // has happened — no message, no membership change — because locationAt is
    // written on every position report.
    const decision = evaluateLifecycle(
      squad({ lastActivityAt: at(-HOUR) }),
      [travelling(at(soft - MINUTE)), travelling(at(soft - MINUTE))],
      at(soft + MINUTE),
    );
    assert.equal(decision.status, 'in_progress');
  });

  it('never lets the hard ceiling fall before soft expiry', () => {
    // A genuinely long squad — 5 hours — would otherwise be killed at the
    // 4-hour ceiling before its own soft expiry had been reached.
    const long = squad({ durationMinutes: 300, lastActivityAt: at(4 * HOUR) });
    const decision = evaluateLifecycle(long, [travelling(at(4 * HOUR))], at(hard + MINUTE));
    assert.equal(decision.status, 'in_progress');
  });
});

describe('squad lifecycle — terminal states are final', () => {
  it('leaves a completed squad completed when the clock moves backwards', () => {
    const decision = evaluateLifecycle(
      squad({ status: 'completed' }),
      [travelling()],
      at(-10 * HOUR),
    );
    assert.equal(decision.status, 'completed');
    assert.equal(decision.changed, false);
  });

  it('does not resurrect a cancelled squad when the quorum is satisfied', () => {
    const decision = evaluateLifecycle(
      squad({ status: 'cancelled' }),
      [arrived(), arrived()],
      at(20 * MINUTE),
    );
    assert.equal(decision.status, 'cancelled');
    assert.equal(decision.changed, false);
  });
});

describe('squad lifecycle — constants are centralised', () => {
  it('holds the agreed defaults in one place', () => {
    // Tunable from real usage later; the point is that they are named and in
    // one module rather than scattered through the call sites.
    assert.equal(LIFECYCLE.DEFAULT_DURATION_MINUTES, 45);
    assert.equal(LIFECYCLE.GRACE_MINUTES, 90);
    assert.equal(LIFECYCLE.QUIET_MINUTES, 30);
    assert.equal(LIFECYCLE.HARD_MAX_HOURS, 4);
    assert.equal(LIFECYCLE.MIN_ARRIVAL_QUORUM, 2);
    // Longer than HARD_MAX_HOURS on purpose: creation is a weaker signal that
    // a trip is over than a stated meeting time is.
    assert.equal(LIFECYCLE.UNSCHEDULED_MAX_HOURS, 6);
  });
});
