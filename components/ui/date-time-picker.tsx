'use client';

import { useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Date + time picker, in the iOS calendar style.
 *
 * Adapted rather than dropped in. The reference implementation hardcoded Apple's
 * palette (#FF3B30, #E3E3E8, #1C1C1E) and carried its own light/dark toggle that
 * wrote to `document.documentElement.classList` — a date picker that changes the
 * whole application's theme is a bug, and the app already owns that switch.
 * Colours come from the design tokens so this works in both themes without
 * knowing which one is active.
 *
 * Two behaviours the reference lacked and a departure time needs:
 *   - days before `minDate` are disabled, because nothing departs in the past,
 *   - the time inputs cannot be left empty, so there is no state where a date is
 *     chosen and the time silently reads NaN.
 */


const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const firstWeekday = (year: number, month: number) => new Date(year, month, 1).getDay();

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * The next five-minute mark at or after `from`.
 *
 * Departures are read and set to the nearest five minutes, so a bound like
 * 14:32:47 is offered as 14:35 rather than shown to the second.
 */
function nextFiveMinutes(from: Date): Date {
  const copy = new Date(from);
  copy.setSeconds(0, 0);
  // setMinutes carries the hour, and the hour the day, when this rounds past
  // the end of one.
  copy.setMinutes(Math.ceil(from.getMinutes() / 5) * 5);
  return copy;
}

export function DateTimePicker({
  value,
  onChange,
  minDate,
  className,
}: {
  /** Selected moment, or null when nothing is chosen yet. */
  value: Date | null;
  onChange: (next: Date) => void;
  /** Days before this are not selectable. Defaults to today. */
  minDate?: Date;
  className?: string;
}) {
  /**
   * Two different floors, because a day and a moment are not the same bar.
   *
   * `earliest` is the first bookable instant; `floor` is the day it falls in.
   * A day is offered when any part of it is still ahead — today at 4pm still
   * has an evening — while a *time* has to clear `earliest` exactly. Comparing
   * times against the start of the day, which is all this used to have, is what
   * let a departure be set for this morning at five.
   */
  const earliest = useMemo(() => minDate ?? new Date(), [minDate]);
  const floor = useMemo(() => startOfDay(earliest), [earliest]);
  const selected = value ?? null;
  const initial = selected ?? new Date();

  const [year, setYear] = useState(initial.getFullYear());
  const [month, setMonth] = useState(initial.getMonth());
  const [pickingMonth, setPickingMonth] = useState(false);

  /**
   * Follow the value when it moves to a month that isn't on screen.
   *
   * The grid is browsable on its own, so the displayed month can't simply be
   * derived from the value. But callers also set the value from outside — the
   * "Tomorrow morning" chip above this picker, a form reset — and on the last
   * day of a month that lands in the next one. Without this the calendar stayed
   * on the old month with no day highlighted anywhere, which reads as the chip
   * having done nothing.
   */
  const valueKey = selected ? `${selected.getFullYear()}-${selected.getMonth()}` : null;
  const [seenValueKey, setSeenValueKey] = useState(valueKey);
  if (selected !== null && valueKey !== seenValueKey) {
    setSeenValueKey(valueKey);
    setYear(selected.getFullYear());
    setMonth(selected.getMonth());
  }

  /**
   * The day every edit that isn't a day tap applies to.
   *
   * Nothing picked yet and the time edited first: today, held inside the
   * browsed month rather than rolling past its end.
   */
  const baseDay =
    selected ?? new Date(year, month, Math.min(new Date().getDate(), daysInMonth(year, month)));

  /**
   * What the time reads before anything has been picked.
   *
   * Nine in the morning, unless that morning has gone — a picker opened at 2pm
   * offering 09:00 is offering a time it will refuse, and the refusal only
   * showed up as the field jumping on the first tap.
   */
  const nine = new Date(baseDay);
  nine.setHours(9, 0, 0, 0);
  const placeholder = nine.getTime() >= earliest.getTime() ? nine : nextFiveMinutes(earliest);

  const hours24 = selected?.getHours() ?? placeholder.getHours();
  const minutes = selected?.getMinutes() ?? placeholder.getMinutes();
  /** A real choice that has already gone — not the untouched placeholder. */
  const isPast = selected !== null && selected.getTime() < earliest.getTime();
  const isPm = hours24 >= 12;
  // 0 and 12 both display as 12 on a 12-hour clock.
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

  /** Writes a new moment, carrying whichever half the caller did not change. */
  const commit = (next: { day?: number; hour12?: number; minute?: number; pm?: boolean }) => {
    /**
     * A day tap means the browsed month; everything else means the selected
     * day, wherever it is. Reading the browsed month for a time edit moved the
     * booking: page forward to September, nudge the hour, and a date chosen in
     * August silently became the same day in September.
     */
    const base = next.day !== undefined ? new Date(year, month, next.day) : baseDay;

    const pm = next.pm ?? isPm;
    const rawHour = next.hour12 ?? hours12;
    const hour = pm ? (rawHour % 12) + 12 : rawHour % 12;

    const result = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      hour,
      next.minute ?? minutes,
      0,
      0,
    );

    /**
     * Committed exactly as chosen, including times that have already gone.
     *
     * An earlier version snapped a past time forward to the next five-minute
     * mark. It meant well and it was wrong: pressing AM at four in the
     * afternoon, or typing an early hour, put the value straight back where it
     * was, so both controls read as dead. The picker now shows what was asked
     * for and says when it is in the past (see `isPast` below) rather than
     * overruling it — the day grid still refuses past *days*, and the server
     * re-checks the moment on submit.
     */
    onChange(result);
  };

  /**
   * Half-typed text, kept out of the committed value.
   *
   * The fields used to render `String(hours).padStart(2, '0')` straight back and
   * re-clamp on every keystroke. Two digits are already on screen, so a typed
   * digit became a third character that the two-character slice threw away:
   * 11 and 12 were unreachable, and any minute past 09 was too — the field just
   * bounced back to what it already said. Typing lands in a draft string
   * instead, so a half-finished entry has somewhere to live.
   *
   * A draft is never nonsense, though. Out-of-range keystrokes are refused at
   * the keypress rather than tidied up later: settling on blur meant `99` sat
   * in the hour field looking accepted, which is no better than the bug it
   * replaced. Only what a clock can actually read gets in.
   */
  const [hourDraft, setHourDraft] = useState<string | null>(null);
  const [minuteDraft, setMinuteDraft] = useState<string | null>(null);

  const typeHour = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 2);
    if (digits === '') {
      // Cleared on the way to retyping. Blur puts the old hour back.
      setHourDraft('');
      return;
    }
    const parsed = Number(digits);
    // 00 and 13–99 are not typos to fix later, they are keystrokes to refuse.
    if (digits.length === 2 && (parsed < 1 || parsed > 12)) return;
    setHourDraft(digits);
    // A lone "0" is a prefix, not an hour; it waits for its second digit.
    if (parsed >= 1 && parsed <= 12) commit({ hour12: parsed });
  };

  const typeMinute = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 2);
    if (digits === '') {
      setMinuteDraft('');
      return;
    }
    const parsed = Number(digits);
    if (parsed > 59) return;
    setMinuteDraft(digits);
    commit({ minute: parsed });
  };

  const stepHour = (delta: number) => {
    // 1..12, wrapping — an hour field has no edges to stop at.
    commit({ hour12: ((hours12 - 1 + delta + 12) % 12) + 1 });
    setHourDraft(null);
  };

  const stepMinute = (delta: number) => {
    // In fives: departures are set to the nearest five minutes, and stepping
    // one at a time makes the far half of the range a chore to reach.
    const snapped = Math.round(minutes / 5) * 5 + delta * 5;
    commit({ minute: (snapped + 60) % 60 });
    setMinuteDraft(null);
  };

  const timeFieldKeys =
    (stepBy: (delta: number) => void) => (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        stepBy(1);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        stepBy(-1);
      } else if (event.key === 'Enter') {
        // Inside a form this would otherwise submit while a draft is unsettled.
        event.preventDefault();
        event.currentTarget.blur();
      }
    };

  const step = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  };

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday(year, month) }, () => null),
    ...Array.from({ length: daysInMonth(year, month) }, (_, index) => index + 1),
  ];

  return (
    <div
      className={cn(
        'w-full max-w-[330px] rounded-xl border border-line bg-surface p-4 shadow-soft',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setPickingMonth((open) => !open)}
          aria-expanded={pickingMonth}
          className="flex items-center gap-1 text-[15px] font-semibold text-ink transition-opacity hover:opacity-70"
        >
          {MONTHS[month]} {year}
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform', pickingMonth && 'rotate-180')}
          />
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous month"
            className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next month"
            className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative mt-3">
        <div className="grid grid-cols-7 gap-y-1 text-center">
          {WEEKDAYS.map((label, index) => (
            <div
              key={`${label}-${index}`}
              className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 justify-items-center gap-y-1">
          {cells.map((day, index) => {
            if (day === null) return <span key={`pad-${index}`} className="h-9 w-9" />;

            const date = new Date(year, month, day);
            const disabled = date < floor;
            const isSelected =
              selected !== null &&
              selected.getFullYear() === year &&
              selected.getMonth() === month &&
              selected.getDate() === day;

            return (
              <button
                key={day}
                type="button"
                disabled={disabled}
                aria-pressed={isSelected}
                onClick={() => commit({ day })}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-medium transition-colors',
                  isSelected
                    ? 'bg-brand font-semibold text-brand-fg'
                    : 'text-ink hover:bg-surface-sunken',
                  disabled && 'pointer-events-none text-ink-subtle opacity-40',
                )}
              >
                {day}
              </button>
            );
          })}
        </div>

        {pickingMonth ? (
          <div className="absolute inset-0 z-20 rounded-lg bg-surface p-2 backdrop-blur-sm">
            <div className="mb-2 flex items-center justify-between border-b border-line pb-2">
              <button
                type="button"
                onClick={() => setYear((y) => y - 1)}
                aria-label="Previous year"
                className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-[15px] font-bold text-ink">{year}</span>
              <button
                type="button"
                onClick={() => setYear((y) => y + 1)}
                aria-label="Next year"
                className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS.map((name, index) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setMonth(index);
                    setPickingMonth(false);
                  }}
                  className={cn(
                    'rounded-md py-1.5 text-[12px] font-bold transition-colors',
                    index === month
                      ? 'bg-brand text-brand-fg'
                      : 'text-ink hover:bg-surface-sunken',
                  )}
                >
                  {name.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-line pt-3.5">
        <span className="text-[15px] font-semibold text-ink">Time</span>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md bg-surface-sunken px-2 py-1 text-[15px] font-semibold tabular-nums text-ink">
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              aria-label="Hour"
              value={hourDraft ?? String(hours12).padStart(2, '0')}
              // Select on focus, so the first digit typed replaces the hour
              // rather than being inserted next to it.
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => typeHour(event.target.value)}
              // Nothing to settle: a draft is either a real hour or empty, so
              // this only drops back to showing the committed value.
              onBlur={() => setHourDraft(null)}
              onKeyDown={timeFieldKeys(stepHour)}
              className="w-7 bg-transparent text-center outline-none"
            />
            <span className="opacity-60">:</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              aria-label="Minute"
              value={minuteDraft ?? String(minutes).padStart(2, '0')}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => typeMinute(event.target.value)}
              onBlur={() => setMinuteDraft(null)}
              onKeyDown={timeFieldKeys(stepMinute)}
              className="w-7 bg-transparent text-center outline-none"
            />
          </div>

          <div
            role="group"
            aria-label="AM or PM"
            className="flex rounded-md bg-surface-sunken p-[2px] text-[12px] font-semibold"
          >
            {/*
              Both halves always press.

              AM was disabled once the morning had gone, on the theory that an
              unreachable half-day should not be offered. In the hand it just
              read as a broken button — the toggle is how you say "nine in the
              morning" before you have said which day, and refusing the press
              blocks the sentence halfway through. It sets AM; if that lands in
              the past, the line below says so.
            */}
            {([false, true] as const).map((pm) => (
              <button
                key={pm ? 'PM' : 'AM'}
                type="button"
                aria-pressed={isPm === pm}
                onClick={() => commit({ pm })}
                className={cn(
                  'rounded px-2.5 py-1 transition-colors',
                  isPm === pm ? 'bg-surface text-ink shadow-soft' : 'text-ink-muted',
                )}
              >
                {pm ? 'PM' : 'AM'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/*
        Said out loud instead of silently corrected.

        A past time is worth flagging — the server rejects it on submit — but
        rewriting the value to enforce that made the controls that produced it
        feel broken. This states the problem and leaves the fix to the person
        who can tell which half was wrong, the time or the day.
      */}
      {isPast ? (
        <p role="status" className="mt-2.5 text-[12px] leading-relaxed text-warning">
          That time has already passed. Pick a later one, or a different day.
        </p>
      ) : null}
    </div>
  );
}
