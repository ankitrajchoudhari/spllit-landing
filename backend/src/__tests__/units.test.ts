import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fitToCorridor, scoreFit, DEFAULT_CORRIDOR } from '../services/corridor.js';
import {
  ARRIVAL_RADIUS_METRES,
  capabilitiesFor,
  generateJoinCode,
  SQUAD_ROLES,
} from '../services/squads.js';
import { formatPlate, isValidPlate, normalisePlate, findModel } from '../data/vehicles.js';
import { squadPostDenial } from '../services/threads.js';
import { CHAT_RETENTION, chatAccess } from '../services/squadChatRetention.js';
import { calculateDistance, calculateDistanceMetres } from '../utils/helpers.js';
import { emailMatchesInstitute } from '../data/institutes.js';
import {
  EMAIL_CATEGORIES,
  OPTIONAL_CATEGORIES,
  QUIET_HOURS,
  isQuietHour,
} from '../services/emailPolicy.js';

/**
 * Unit tests for the pure logic — the parts where a wrong answer is silent.
 *
 * Uses node:test, which ships with Node, rather than adding a runner. These
 * touch no database and no network, so they run anywhere the repo does.
 */

const METRES_PER_DEGREE_LAT = 111_320;

describe('corridor matching', () => {
  // A ~11 km due-east route at constant latitude, so offsets are exact.
  const host = [
    { lat: 13.0, lng: 80.2 },
    { lat: 13.0, lng: 80.3 },
  ];
  const offsetNorth = (metres: number, lng: number) => ({
    lat: 13.0 + metres / METRES_PER_DEGREE_LAT,
    lng,
  });

  it('matches a rider 1 km off the route travelling the same way', () => {
    const fit = fitToCorridor(host, offsetNorth(1000, 80.22), offsetNorth(1000, 80.28));
    assert.ok(fit);
    assert.equal(scoreFit(fit).matches, true);
  });

  it('rejects a rider beyond the buffer', () => {
    const fit = fitToCorridor(host, offsetNorth(2500, 80.22), offsetNorth(2500, 80.28));
    assert.ok(fit);
    assert.equal(scoreFit(fit).matches, false);
  });

  it('rejects a rider going the opposite way down the same corridor', () => {
    // Proximity alone would rank this a perfect match; only the ordering check
    // catches it.
    const fit = fitToCorridor(host, { lat: 13.0, lng: 80.28 }, { lat: 13.0, lng: 80.22 });
    assert.ok(fit);
    assert.equal(scoreFit(fit).matches, false);
    assert.ok(scoreFit(fit).sharedMetres < 0);
  });

  it('rejects a pickup and drop-off that barely differ', () => {
    const fit = fitToCorridor(host, { lat: 13.0, lng: 80.25 }, { lat: 13.0, lng: 80.2502 });
    assert.ok(fit);
    assert.ok(scoreFit(fit).sharedMetres < DEFAULT_CORRIDOR.minSharedMetres);
    assert.equal(scoreFit(fit).matches, false);
  });

  it('projects distance accurately', () => {
    const fit = fitToCorridor(host, offsetNorth(1000, 80.25), offsetNorth(1000, 80.28));
    assert.ok(fit);
    assert.ok(Math.abs(fit.pickupDetourMetres - 1000) < 5);
  });

  it('returns null for a path with no direction', () => {
    assert.equal(fitToCorridor([{ lat: 13, lng: 80 }], host[0]!, host[1]!), null);
  });
});

describe('distance units', () => {
  it('calculateDistance is kilometres and the metres helper agrees', () => {
    // The bug this guards: three call sites treated the km result as metres,
    // which silently disabled a radius filter and mislabelled UI distances.
    const km = calculateDistance(13.0, 80.2, 13.0, 80.3);
    const metres = calculateDistanceMetres(13.0, 80.2, 13.0, 80.3);
    assert.ok(km > 10 && km < 12, `expected ~11 km, got ${km}`);
    assert.equal(Math.round(metres), Math.round(km * 1000));
  });
});

describe('squad permissions', () => {
  it('gives the leader every capability', () => {
    const can = capabilitiesFor('leader');
    assert.ok(Object.values(can).every(Boolean));
  });

  it('lets a co-leader run the squad but not end it or reassign roles', () => {
    const can = capabilitiesFor('co-leader');
    assert.equal(can.setMeetingPoint, true);
    assert.equal(can.admitMembers, true);
    assert.equal(can.destroy, false);
    assert.equal(can.assignRoles, false);
  });

  it('limits a member to taking part', () => {
    const can = capabilitiesFor('member');
    assert.equal(can.chat, true);
    assert.equal(can.shareLocation, true);
    assert.equal(can.setMeetingPoint, false);
    assert.equal(can.manageMembers, false);
  });

  it('limits a guest to viewing and navigating', () => {
    const can = capabilitiesFor('guest');
    assert.equal(can.view, true);
    assert.equal(can.shareLocation, true);
    assert.equal(can.chat, false);
    assert.equal(can.admitMembers, false);
  });

  it('never grants destroy below leader', () => {
    for (const role of SQUAD_ROLES.filter((r) => r !== 'leader')) {
      assert.equal(capabilitiesFor(role).destroy, false, `${role} must not destroy`);
    }
  });
});

describe('join codes', () => {
  it('drops one side of every confusable pair', () => {
    // Only one of each pair may survive — O/0, I/1, S/5. Keeping 5 while
    // dropping S is correct; keeping both would not be.
    for (let i = 0; i < 500; i += 1) {
      const code = generateJoinCode();
      assert.equal(code.length, 6);
      assert.match(code, /^[A-Z0-9]{6}$/);
      assert.doesNotMatch(code, /[O0I1S]/, `ambiguous character in ${code}`);
    }
  });

  it('spreads across the alphabet rather than repeating one symbol', () => {
    // A constant or near-constant generator would still satisfy the format
    // assertions above while making collisions certain.
    const seen = new Set<string>();
    for (let i = 0; i < 300; i += 1) {
      for (const char of generateJoinCode()) seen.add(char);
    }
    assert.ok(seen.size > 25, `only ${seen.size} distinct characters generated`);
  });
});

describe('arrival radius', () => {
  it('is tight enough to mean "at the meeting point"', () => {
    assert.ok(ARRIVAL_RADIUS_METRES > 0 && ARRIVAL_RADIUS_METRES <= 50);
  });
});

describe('registration plates', () => {
  it('accepts both live Indian formats however they are typed', () => {
    for (const raw of ['TN07CV1234', 'tn 07 cv 1234', 'TN-07-CV-1234', 'MH12AB1234']) {
      assert.equal(isValidPlate(normalisePlate(raw)), true, raw);
    }
    assert.equal(isValidPlate(normalisePlate('22 BH 1234 AA')), true);
  });

  it('normalises separators away so one plate is one row', () => {
    assert.equal(normalisePlate('tn 07 cv 1234'), 'TN07CV1234');
    assert.equal(normalisePlate('TN-07-CV-1234'), 'TN07CV1234');
  });

  it('rejects malformed marks', () => {
    for (const raw of ['', 'ABC', '1234567890', 'T1N07CV', 'TN07CV12345']) {
      assert.equal(isValidPlate(normalisePlate(raw)), false, raw);
    }
  });

  it('formats back into readable groups', () => {
    assert.equal(formatPlate('TN07CV1234'), 'TN 07 CV 1234');
    assert.equal(formatPlate('22BH1234AA'), '22 BH 1234 AA');
  });
});

describe('vehicle catalogue', () => {
  it('resolves real brand/model pairs and rejects invented ones', () => {
    assert.ok(findModel('maruti-suzuki', 'ertiga'));
    assert.equal(findModel('maruti-suzuki', 'not-a-model'), null);
    assert.equal(findModel('not-a-brand', 'ertiga'), null);
  });

  it('caps seats at what the model actually has', () => {
    // The guard against a host advertising six seats in a hatchback.
    assert.equal(findModel('maruti-suzuki', 'ertiga')?.seats, 6);
    assert.equal(findModel('maruti-suzuki', 'alto-k10')?.seats, 4);
    assert.equal(findModel('hero', 'splendor')?.seats, 1);
  });
});

/**
 * Squad-chat write rule.
 *
 * A cancelled squad went on accepting messages because the only check was
 * `participantIds`, which is a historical list and never shrinks. These pin the
 * rule that replaced it, including the two cases that matter most: a terminal
 * squad, and a member who has left.
 */
describe('squad chat write gate', () => {
  const live = { name: 'Taramani Exam Squad', status: 'active', endedAt: null };

  /** A fixed clock, so the grace-window cases are not relative to test runtime. */
  const NOW = new Date('2026-08-14T12:00:00.000Z');
  const endedHoursAgo = (hours: number, status = 'completed') => ({
    ...live,
    status,
    endedAt: new Date(NOW.getTime() - hours * 3600 * 1000),
  });

  it('lets an active member of an active squad post', () => {
    assert.equal(squadPostDenial(live, 'active'), null);
  });

  it('lets a member who is travelling or arrived post', () => {
    // Journey states are not membership states.
    assert.equal(squadPostDenial(live, 'travelling'), null);
    assert.equal(squadPostDenial(live, 'arrived'), null);
  });

  it('keeps the conversation open once the squad has started', () => {
    // in_progress means the meeting time has passed and people may still be
    // travelling — the moment "I'm five minutes away" most needs sending.
    // Gating on 'active' alone would cut the squad off exactly then.
    const started = { ...live, status: 'in_progress' };
    assert.equal(squadPostDenial(started, 'active'), null);
    assert.equal(squadPostDenial(started, 'travelling'), null);
    assert.equal(squadPostDenial(started, 'arrived'), null);
  });

  it('still refuses a non-member in a squad that has started', () => {
    const denial = squadPostDenial({ ...live, status: 'in_progress' }, 'left');
    assert.equal(denial?.code, 'not-a-member');
  });

  it('keeps chat open for a grace window after the squad ends', () => {
    /**
     * Ending is when people settle up, say where they left a bag, and say
     * goodbye. Cutting writes off at the instant of the terminal transition —
     * which is what this did — took the conversation away at the moment it was
     * most in use.
     */
    for (const status of ['completed', 'cancelled']) {
      assert.equal(squadPostDenial(endedHoursAgo(1, status), 'active', NOW), null);
    }
  });

  it('lets a released member post inside the grace window', () => {
    // Ending a squad sets every member to `left`, so requiring active
    // membership after the end would close the window at the moment it opened.
    assert.equal(squadPostDenial(endedHoursAgo(2), 'left', NOW), null);
  });

  it('closes the conversation once the grace window has passed', () => {
    for (const status of ['completed', 'cancelled']) {
      const denial = squadPostDenial(endedHoursAgo(CHAT_RETENTION.LOCK_HOURS + 1, status), 'active', NOW);
      assert.equal(denial?.code, 'squad-chat-closed');
      assert.equal(denial?.status, 403);
    }
  });

  it('closes exactly at the boundary, not a moment later', () => {
    assert.equal(squadPostDenial(endedHoursAgo(CHAT_RETENTION.LOCK_HOURS - 0.01), 'active', NOW), null);
    assert.equal(
      squadPostDenial(endedHoursAgo(CHAT_RETENTION.LOCK_HOURS), 'active', NOW)?.code,
      'squad-chat-closed',
    );
  });

  it('leaves a squad that ended before endedAt existed alone', () => {
    // Null anchor: nothing to measure from, so it stays readable rather than
    // being retroactively closed because a column was added later.
    assert.equal(squadPostDenial({ ...live, status: 'completed', endedAt: null }, 'active', NOW), null);
  });

  it('names the squad in the refusal so the client can explain it', () => {
    const denial = squadPostDenial(endedHoursAgo(CHAT_RETENTION.LOCK_HOURS + 1), 'active', NOW);
    assert.ok(denial!.message.includes('Taramani Exam Squad'));
  });

  it('refuses a member who has left, while the squad is still live', () => {
    const denial = squadPostDenial(live, 'left');
    assert.equal(denial?.code, 'not-a-member');
    assert.equal(denial?.status, 403);
  });

  it('refuses someone with no membership row at all', () => {
    assert.equal(squadPostDenial(live, null)?.code, 'not-a-member');
  });

  it('refuses a pending member — approval is what grants the microphone', () => {
    assert.equal(squadPostDenial(live, 'pending')?.code, 'not-a-member');
  });

  it('refuses a removed member', () => {
    assert.equal(squadPostDenial(live, 'removed')?.code, 'not-a-member');
  });

  it('404s when the squad row is gone', () => {
    const denial = squadPostDenial(null, 'active');
    assert.equal(denial?.status, 404);
  });

  it('checks the squad lifecycle before membership', () => {
    // A closed conversation refuses even someone whose membership is
    // immaculate, and says so as "closed" rather than blaming the member.
    assert.equal(
      squadPostDenial(endedHoursAgo(CHAT_RETENTION.LOCK_HOURS + 1, 'cancelled'), 'active', NOW)?.code,
      'squad-chat-closed',
    );
  });
});

describe('squad chat retention', () => {
  const NOW = new Date('2026-08-14T12:00:00.000Z');
  const HOUR = 3600 * 1000;
  const DAY = 24 * HOUR;
  const ended = (msAgo: number, status = 'completed') => ({
    status,
    endedAt: new Date(NOW.getTime() - msAgo),
  });

  it('leaves a live squad open however long it has been running', () => {
    for (const status of ['active', 'in_progress']) {
      assert.equal(chatAccess({ status, endedAt: null }, NOW), 'open');
    }
  });

  it('ignores a stale endedAt on a squad that is live again', () => {
    // status wins: endedAt is only meaningful once the squad is terminal.
    assert.equal(chatAccess({ status: 'active', endedAt: new Date(0) }, NOW), 'open');
  });

  it('stays open through the grace window, then locks', () => {
    assert.equal(chatAccess(ended(CHAT_RETENTION.LOCK_HOURS * HOUR - 1), NOW), 'open');
    assert.equal(chatAccess(ended(CHAT_RETENTION.LOCK_HOURS * HOUR), NOW), 'locked');
  });

  it('stays locked — not erased — until the erase window is reached', () => {
    assert.equal(chatAccess(ended(CHAT_RETENTION.ERASE_DAYS * DAY - 1), NOW), 'locked');
    assert.equal(chatAccess(ended(CHAT_RETENTION.ERASE_DAYS * DAY), NOW), 'erased');
  });

  it('keeps a gap between losing access and losing the data', () => {
    /**
     * The whole point of the two windows. Locking is instant and reversible;
     * deletion is neither. The days in between are what make a harassment
     * report actionable after the reporter has lost access to the evidence.
     */
    assert.ok(CHAT_RETENTION.ERASE_DAYS * 24 > CHAT_RETENTION.LOCK_HOURS);
  });

  it('treats a squad with no endedAt as open, whatever its status', () => {
    // Ended before the column existed. Retroactively erasing those would be an
    // unpleasant surprise, and the number of them only shrinks.
    assert.equal(chatAccess({ status: 'completed', endedAt: null }, NOW), 'open');
    assert.equal(chatAccess({ status: 'cancelled', endedAt: null }, NOW), 'open');
  });

  it('applies to cancelled squads exactly as to completed ones', () => {
    assert.equal(chatAccess(ended(CHAT_RETENTION.LOCK_HOURS * HOUR, 'cancelled'), NOW), 'locked');
  });
});

describe('email categories', () => {
  it('gives every category a distinct id', () => {
    const ids = Object.values(EMAIL_CATEGORIES);
    assert.equal(new Set(ids).size, ids.length);
  });

  /**
   * A category missing from this list cannot be switched off — the preference
   * is read but `mayEmail` ignores it for anything not listed here, so the
   * toggle would appear in Settings and silently do nothing.
   */
  it('lets somebody switch off everything that is not an answer they asked for', () => {
    for (const category of [
      EMAIL_CATEGORIES.JOIN_REQUEST,
      EMAIL_CATEGORIES.TRIP_CREATED,
      EMAIL_CATEGORIES.WELCOME,
      EMAIL_CATEGORIES.CAMPAIGN,
    ]) {
      assert.ok(OPTIONAL_CATEGORIES.includes(category), `${category} should be optional`);
    }
  });

  /**
   * The answer to a request is the one thing a person cannot turn off, because
   * being silently left out of a squad they asked to join is worse than an
   * unwanted email.
   */
  it('keeps the acceptance answer mandatory', () => {
    assert.ok(!OPTIONAL_CATEGORIES.includes(EMAIL_CATEGORIES.REQUEST_ACCEPTED));
  });
});

describe('quiet hours', () => {
  /** 2026-09-12T18:00:00Z is 11:30pm in Kolkata — inside the window. */
  const lateNight = new Date('2026-09-12T18:00:00Z');
  /** Same day, 09:30 Kolkata. */
  const morning = new Date('2026-09-12T04:00:00Z');

  it('wraps midnight rather than treating the window as a range', () => {
    assert.equal(isQuietHour(lateNight, 'Asia/Kolkata'), true);
    assert.equal(isQuietHour(morning, 'Asia/Kolkata'), false);
    assert.ok(QUIET_HOURS.START > QUIET_HOURS.END);
  });

  it('treats an unknown timezone as daytime rather than silencing somebody forever', () => {
    assert.equal(isQuietHour(lateNight, 'Not/AZone'), false);
  });
});

describe('institute email verification', () => {
  it('accepts a listed domain', () => {
    assert.equal(emailMatchesInstitute('a@iitm.ac.in', 'iitm'), true);
    assert.equal(emailMatchesInstitute('a@study.iitm.ac.in', 'iitm'), true);
  });

  /**
   * The reason this is not an enumerated list any more. A department or branch
   * address must work without somebody first discovering it exists — that gap
   * told every BS-degree student their correct address was not from IIT Madras.
   */
  it('accepts any sub-domain of a listed domain', () => {
    assert.equal(emailMatchesInstitute('a@ee.iitm.ac.in', 'iitm'), true);
    assert.equal(emailMatchesInstitute('a@cse.ds.study.iitm.ac.in', 'iitm'), true);
    assert.equal(emailMatchesInstitute('a@alumni.iitm.ac.in', 'iitm'), true);
  });

  /**
   * The attacks the leading dot exists to refuse. A look-alike domain an
   * attacker can register must never read as the institute's own.
   */
  it('refuses a domain that merely ends in the right letters', () => {
    assert.equal(emailMatchesInstitute('a@evil-iitm.ac.in', 'iitm'), false);
    assert.equal(emailMatchesInstitute('a@notiitm.ac.in', 'iitm'), false);
  });

  it('refuses the institute domain used as a prefix of an attacker domain', () => {
    assert.equal(emailMatchesInstitute('a@iitm.ac.in.attacker.com', 'iitm'), false);
  });

  it('does not let one institute verify against another', () => {
    assert.equal(emailMatchesInstitute('a@iitd.ac.in', 'iitm'), false);
    assert.equal(emailMatchesInstitute('a@ee.iitm.ac.in', 'iitd'), false);
  });

  it('refuses malformed addresses and institutes with no domain', () => {
    assert.equal(emailMatchesInstitute('a@@iitm.ac.in', 'iitm'), false);
    assert.equal(emailMatchesInstitute('iitm.ac.in', 'iitm'), false);
    assert.equal(emailMatchesInstitute('a@iitm.ac.in', 'other'), false);
  });

  it('ignores case and surrounding space', () => {
    assert.equal(emailMatchesInstitute('  A@EE.IITM.AC.IN  ', 'iitm'), true);
  });
});
