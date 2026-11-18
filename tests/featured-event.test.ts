import test from 'node:test';
import assert from 'node:assert/strict';

import {
  countdown,
  formatWhen,
  mapsHref,
  parseEvents,
  pickEvent,
  registrationOpen,
  type FeaturedEvent,
} from '../lib/featured-event.ts';

function event(id: string, startsAt: string, endsAt: string): FeaturedEvent {
  return {
    id,
    title: `Event ${id}`,
    summary: 'About it',
    poster: '',
    posterAlt: '',
    venue: 'Anna University',
    area: 'Guindy, Chennai',
    mapUrl: '',
    startsAt,
    endsAt,
    registerUrl: 'https://forms.gle/abc',
    registration: 'auto',
  };
}

const a = event('a', '2026-11-20T18:00:00+05:30', '2026-11-20T21:00:00+05:30');
const b = event('b', '2026-11-25T10:00:00+05:30', '2026-11-25T13:00:00+05:30');

test('features the soonest event that has not started', () => {
  const now = Date.parse('2026-11-18T12:00:00+05:30');
  assert.deepEqual(pickEvent([b, a], now), { event: a, phase: 'upcoming' });
});

test('an event in progress is live, and wins over later ones', () => {
  const now = Date.parse('2026-11-20T19:30:00+05:30');
  assert.deepEqual(pickEvent([b, a], now), { event: a, phase: 'live' });
});

test('a finished event gives way to the next, and then to nothing', () => {
  assert.equal(pickEvent([a, b], Date.parse('2026-11-21T09:00:00+05:30'))?.event.id, 'b');
  assert.equal(pickEvent([a, b], Date.parse('2026-11-26T09:00:00+05:30')), null);
});

test('the end instant itself counts as over', () => {
  assert.equal(pickEvent([a], Date.parse(a.endsAt)), null);
});

test('counts down in whole days, hours, minutes and seconds', () => {
  const now = Date.parse('2026-11-18T12:00:00+05:30');
  assert.deepEqual(countdown(Date.parse(a.startsAt), now), {
    days: 2,
    hours: 6,
    minutes: 0,
    seconds: 0,
  });
  assert.deepEqual(countdown(now - 5000, now), { days: 0, hours: 0, minutes: 0, seconds: 0 });
});

test('drops events nobody could attend or register for', () => {
  const parsed = parseEvents({
    events: [
      a,
      { ...b, registerUrl: 'http://forms.gle/x' },
      { ...b, id: 'c', endsAt: b.startsAt },
      { ...b, id: 'd', startsAt: 'next friday' },
      { ...b, id: 'e', venue: '' },
      'nonsense',
    ],
  });
  assert.deepEqual(
    parsed.map((e) => e.id),
    ['a'],
  );
  assert.deepEqual(parseEvents(null), []);
});

test('keeps only https posters', () => {
  const [parsed] = parseEvents({ events: [{ ...a, poster: 'javascript:alert(1)' }] });
  assert.equal(parsed?.poster, '');
});

test('links to the map given, or searches for the venue', () => {
  assert.equal(
    mapsHref(a),
    'https://www.google.com/maps/search/?api=1&query=Anna%20University%2C%20Guindy%2C%20Chennai',
  );
  assert.equal(
    mapsHref({ ...a, mapUrl: 'https://maps.app.goo.gl/x' }),
    'https://maps.app.goo.gl/x',
  );
});

test('says when in IST, with both dates only when it crosses midnight', () => {
  assert.equal(formatWhen(a), 'Fri, 20 Nov · 6:00 PM – 9:00 PM IST');
  const late = event('l', '2026-11-20T22:00:00+05:30', '2026-11-21T01:00:00+05:30');
  assert.equal(formatWhen(late), 'Fri, 20 Nov, 10:00 PM – Sat, 21 Nov, 1:00 AM IST');
});

test('registration: auto closes at the start, open runs to the end, closed is closed', () => {
  assert.equal(registrationOpen({ registration: 'auto' }, 'upcoming'), true);
  assert.equal(registrationOpen({ registration: 'auto' }, 'live'), false);
  assert.equal(registrationOpen({ registration: 'open' }, 'live'), true);
  assert.equal(registrationOpen({ registration: 'closed' }, 'upcoming'), false);
});

test('an unknown or missing registration setting reads as auto', () => {
  const [parsed] = parseEvents({ events: [{ ...a, registration: 'sometimes' }] });
  assert.equal(parsed?.registration, 'auto');
});
