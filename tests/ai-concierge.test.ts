/**
 * What the assistant asks, and what it must never ask twice.
 *
 * Two failures matter here and neither is visible in a screenshot: being asked
 * for something you have already given, and being asked for nothing while the
 * confirmation card is still missing a field. Both are properties of the state
 * machine, so they are pinned here rather than clicked through.
 *
 * The third thing under test is `needsInterpretation`, which decides whether a
 * line of text costs ten to thirty-five seconds and real money, or nothing at
 * all. Getting that wrong is not a correctness bug — it is the difference
 * between the assistant feeling instant and feeling broken.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INITIAL_STATE,
  answer,
  skip,
  nextQuestion,
  isReady,
  needsInterpretation,
  summarise,
  combineDeparture,
  localDateKey,
  localTimeKey,
  applyExtraction,
  buildTranscript,
  type ConciergeState,
} from '../lib/ai-concierge.ts';

const TARAMANI = {
  lng: 80.2404,
  lat: 12.9877,
  label: 'Taramani, Chennai',
  address: 'Chennai, Tamil Nadu',
};

const VELACHERY = {
  lng: 80.2184,
  lat: 12.98,
  label: 'Velachery, Chennai',
  address: 'Chennai, Tamil Nadu',
};

// --- Question order -------------------------------------------------------

test('the first question is always the destination', () => {
  const question = nextQuestion(INITIAL_STATE);
  assert.equal(question?.slot, 'destination');
  // It is the one thing a squad cannot be created without, so it is the one
  // question that is not skippable.
  assert.equal(question?.skippable, false);
});

test('an answered slot is never asked about again', () => {
  const state = answer(INITIAL_STATE, 'destination', TARAMANI);
  const question = nextQuestion(state);

  assert.notEqual(question?.slot, 'destination');
  assert.equal(question?.slot, 'origin');
});

test('a skipped slot is never asked about again', () => {
  let state = answer(INITIAL_STATE, 'destination', TARAMANI);
  state = skip(state, 'origin');

  assert.equal(nextQuestion(state)?.slot, 'departDate');
});

test('questions run destination, origin, date, time, purpose, meeting point', () => {
  const asked: string[] = [];
  let state: ConciergeState = INITIAL_STATE;

  for (let guard = 0; guard < 12; guard += 1) {
    const question = nextQuestion(state);
    if (!question) break;
    asked.push(question.slot);
    // Answer each with something plausible so the walk advances.
    state =
      question.slot === 'destination'
        ? answer(state, 'destination', TARAMANI)
        : question.slot === 'origin'
          ? answer(state, 'origin', VELACHERY)
          : question.slot === 'departDate'
            ? answer(state, 'departDate', '2026-08-16')
            : question.slot === 'departTime'
              ? answer(state, 'departTime', '09:00')
              : question.slot === 'purpose'
                ? answer(state, 'purpose', 'exam')
                : answer(state, 'meetingPoint', TARAMANI);
  }

  assert.deepEqual(asked, [
    'destination', 'origin', 'departDate', 'departTime', 'purpose', 'meetingPoint',
  ]);
});

test('everything answered means nothing left to ask', () => {
  let state = answer(INITIAL_STATE, 'destination', TARAMANI);
  state = answer(state, 'origin', VELACHERY);
  state = answer(state, 'departDate', '2026-08-16');
  state = answer(state, 'departTime', '09:00');
  state = answer(state, 'purpose', 'exam');
  state = answer(state, 'meetingPoint', TARAMANI);

  assert.equal(nextQuestion(state), null);
});

test('the time is not asked when the date was skipped', () => {
  // A clock time with no day is not a departure and cannot be stored, so
  // collecting one would be asking a question to throw the answer away.
  let state = answer(INITIAL_STATE, 'destination', TARAMANI);
  state = skip(state, 'origin');
  state = skip(state, 'departDate');

  assert.equal(nextQuestion(state)?.slot, 'purpose');
});

test('skipping the date skips the time in the state, not just in the order', () => {
  const state = skip(INITIAL_STATE, 'departDate');
  assert.ok(state.skipped.includes('departTime'));
});

test('answering a slot undoes an earlier skip of it', () => {
  let state = skip(INITIAL_STATE, 'purpose');
  state = answer(state, 'purpose', 'exam');
  assert.ok(!state.skipped.includes('purpose'));
});

// --- Readiness ------------------------------------------------------------

test('a destination alone is enough to create a squad', () => {
  assert.equal(isReady(answer(INITIAL_STATE, 'destination', TARAMANI)), true);
});

test('nothing at all is not enough', () => {
  assert.equal(isReady(INITIAL_STATE), false);
});

// --- Interpretation, the thing that costs 10-35 seconds --------------------

test('a bare place name never reaches the model', () => {
  // The exact case that used to answer "couldn't read a trip in that".
  for (const text of ['taramani', 'IIT Madras', 'Anna University Research Park']) {
    assert.equal(needsInterpretation(text), false, `${text} should be looked up, not interpreted`);
  }
});

test('a sentence with a time reaches the model', () => {
  for (const text of [
    'Tomorrow at 9 AM I want to go from Velachery to IIT Madras for my maths exam',
    'kal 9 baje Velachery se IIT Madras jaana hai',
    'going to office tomorrow morning',
  ]) {
    assert.equal(needsInterpretation(text), true, `${text} needs interpreting`);
  }
});

test('a journey word alone is enough to interpret', () => {
  assert.equal(needsInterpretation('from velachery to taramani'), true);
});

test('a purpose word alone is enough to interpret', () => {
  assert.equal(needsInterpretation('maths exam at IITM'), true);
});

test('a long line is interpreted even with no keywords', () => {
  assert.equal(needsInterpretation('a b c d e f g'), true);
});

test('empty input is never sent anywhere', () => {
  assert.equal(needsInterpretation('   '), false);
});

// --- Departure ------------------------------------------------------------

test('a date without a time is not a departure', () => {
  // Midnight is a value nobody chose.
  assert.equal(combineDeparture('2026-08-16', null), null);
});

test('a time without a date is not a departure', () => {
  assert.equal(combineDeparture(null, '09:00'), null);
});

test('date and time combine on the local clock', () => {
  const when = combineDeparture('2026-08-16', '09:00');
  assert.ok(when);
  assert.equal(when.getFullYear(), 2026);
  assert.equal(when.getMonth(), 7);
  assert.equal(when.getDate(), 16);
  assert.equal(when.getHours(), 9);
  assert.equal(when.getMinutes(), 0);
});

test('local date and time keys round-trip', () => {
  const when = new Date(2026, 7, 16, 9, 5);
  assert.equal(localDateKey(when), '2026-08-16');
  assert.equal(localTimeKey(when), '09:05');
  assert.deepEqual(combineDeparture(localDateKey(when), localTimeKey(when)), when);
});

// --- Folding in an extraction ---------------------------------------------

const EXTRACTED = {
  destination: { ...TARAMANI, featureType: 'locality' },
  origin: { ...VELACHERY, featureType: 'locality' },
  departAt: new Date(2026, 7, 16, 9, 0).toISOString(),
  purpose: 'exam' as const,
};

test('an extraction fills every empty slot at once', () => {
  const state = applyExtraction(INITIAL_STATE, EXTRACTED);

  assert.equal(state.slots.destination?.label, TARAMANI.label);
  assert.equal(state.slots.origin?.label, VELACHERY.label);
  assert.equal(state.slots.departDate, '2026-08-16');
  assert.equal(state.slots.departTime, '09:00');
  assert.equal(state.slots.purpose, 'exam');
});

test('a full sentence leaves only the meeting point to ask about', () => {
  const state = applyExtraction(INITIAL_STATE, EXTRACTED);
  assert.equal(nextQuestion(state)?.slot, 'meetingPoint');
});

test('an answer the user gave outranks the model', () => {
  // A person tapping a choice is a stronger signal than a model reading a
  // sentence, so their destination survives an extraction that disagrees.
  const chosen = answer(INITIAL_STATE, 'destination', VELACHERY);
  const state = applyExtraction(chosen, EXTRACTED);

  assert.equal(state.slots.destination?.label, VELACHERY.label);
});

test('an unparseable departure fills nothing rather than something wrong', () => {
  const state = applyExtraction(INITIAL_STATE, { ...EXTRACTED, departAt: 'not-a-date' });
  assert.equal(state.slots.departDate, null);
  assert.equal(state.slots.departTime, null);
});

// --- The confirmation card ------------------------------------------------

test('the summary names the squad the same way the manual form does', () => {
  let state = answer(INITIAL_STATE, 'destination', TARAMANI);
  state = answer(state, 'purpose', 'exam');

  // Literally the same function the manual form calls, so the two cannot drift.
  // (The old 'Taramani exam run' spelling predates suggestSquadName being
  // rewritten to the '<place> <purpose> Squad' form.)
  assert.equal(summarise(state).name, 'Taramani Exam Squad');
});

test('no meeting point falls back to the destination, and says so', () => {
  const state = answer(INITIAL_STATE, 'destination', TARAMANI);
  const summary = summarise(state);

  assert.equal(summary.meetingLabel, 'Taramani');
  // The card has to distinguish a chosen point from a defaulted one, or it
  // claims a decision nobody made.
  assert.equal(summary.meetingIsDefault, true);
});

test('a chosen meeting point is not marked as a default', () => {
  let state = answer(INITIAL_STATE, 'destination', TARAMANI);
  state = answer(state, 'meetingPoint', VELACHERY);

  const summary = summarise(state);
  assert.equal(summary.meetingLabel, 'Velachery');
  assert.equal(summary.meetingIsDefault, false);
});

test('no purpose given still produces a valid squad type', () => {
  const state = answer(INITIAL_STATE, 'destination', TARAMANI);
  assert.equal(summarise(state).purpose, 'general');
});

// --- The transcript, which must never disagree with the state --------------

test('the transcript is empty before anything is said', () => {
  assert.deepEqual(buildTranscript(INITIAL_STATE), []);
});

test('the opening sentence stays in the conversation', () => {
  const turns = buildTranscript(INITIAL_STATE, 'taramani');
  assert.equal(turns.length, 1);
  assert.equal(turns[0]?.role, 'user');
  assert.equal(turns[0]?.text, 'taramani');
});

test('each answered slot becomes a question and a reply', () => {
  const state = answer(INITIAL_STATE, 'destination', TARAMANI);
  const turns = buildTranscript(state);

  assert.equal(turns.length, 2);
  assert.equal(turns[0]?.role, 'ai');
  assert.equal(turns[1]?.role, 'user');
  // Read back as the person would say it, not as it is stored.
  assert.equal(turns[1]?.text, 'Taramani');
});

test('a skipped answer says so rather than vanishing', () => {
  let state = answer(INITIAL_STATE, 'destination', TARAMANI);
  state = skip(state, 'origin');

  const replies = buildTranscript(state).filter((t) => t.role === 'user');
  assert.ok(replies.some((t) => t.text === 'Skip for now'));
});

test('a time skipped only because the date was never gets a bubble', () => {
  // It was never asked, so a question about it in the transcript would be a
  // record of something that did not happen.
  const state = skip(INITIAL_STATE, 'departDate');
  const turns = buildTranscript(state);

  assert.equal(turns.filter((t) => t.id.startsWith('departTime')).length, 0);
});

test('dates and times read back in words, not keys', () => {
  let state = answer(INITIAL_STATE, 'departDate', localDateKey(new Date()));
  state = answer(state, 'departTime', '09:00');

  const replies = buildTranscript(state).filter((t) => t.role === 'user');
  assert.ok(replies.some((t) => t.text === 'Today'), 'expected a "Today" reply');
  assert.ok(!replies.some((t) => t.text === '09:00'), 'raw 09:00 leaked into the chat');
});

test('the transcript cannot disagree with the slots', () => {
  // Changing an answer changes the bubble, because the bubble is derived from
  // the slot rather than recorded alongside it.
  let state = answer(INITIAL_STATE, 'destination', TARAMANI);
  state = answer(state, 'destination', VELACHERY);

  const replies = buildTranscript(state).filter((t) => t.role === 'user');
  assert.deepEqual(replies.map((t) => t.text), ['Velachery']);
});
