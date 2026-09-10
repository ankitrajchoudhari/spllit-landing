'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, MapPin, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { PlacePicker, type PickedPlace } from '@/components/shared/place-picker';
import { SpllitAiOrb } from '@/components/shared/spllit-ai-orb';
import { ApiError } from '@/lib/api/client';
import { useCreateSquad, useDraftSquadFromText } from '@/lib/hooks/queries';
import { SQUAD_PURPOSES, purposeIcon, purposeLabel } from '@/lib/squad-purpose';
import {
  INITIAL_STATE,
  answer,
  skip,
  nextQuestion,
  isReady,
  needsInterpretation,
  summarise,
  applyExtraction,
  localDateKey,
  combineDeparture,
  buildTranscript,
  type ConciergeState,
  type Question,
  type ChatTurn,
} from '@/lib/ai-concierge';
import { pickNudge } from '@/lib/ai-nudge';
import { cn } from '@/lib/utils';
import type { LngLat, SquadType } from '@/types';

/**
 * The assistant that builds a squad by asking one thing at a time.
 *
 * It exists because the create form asks seven questions at once, and a form
 * that shows everything it wants before you have answered anything reads as
 * complicated whether or not it is. This asks for one, takes the answer, and
 * asks for the next — skipping every question it already knows.
 *
 * Two rules make it affordable and safe:
 *
 *  1. **At most one model call per squad.** Extraction costs ten to thirty-five
 *     seconds. Calling it per question would put that on every tap. It runs
 *     once, for the opening sentence, and only when that sentence needs
 *     interpreting — `needsInterpretation` sends "taramani" straight to the map
 *     instead. Every answer after that is a local choice.
 *
 *  2. **The assistant asks; the app answers.** Every place comes from
 *     `PlacePicker`, which is Mapbox — the same component the manual form uses.
 *     Nothing here produces a coordinate, and the squad is created by the same
 *     endpoint with the same validation, only after the user reads a summary
 *     and presses the button.
 *
 * Closing gives everything back: whatever was collected is handed to the create
 * form, so nobody loses answers by changing their mind about the interface.
 */

type Stage = 'intro' | 'interpreting' | 'asking' | 'confirm';

export function AiConcierge({
  open,
  onClose,
  near,
  college,
}: {
  open: boolean;
  /** Receives everything collected, so the form can carry on from here. */
  onClose: (state: ConciergeState) => void;
  near?: LngLat | null;
  /** Stamped onto the squad, exactly as the manual form does. */
  college?: string | undefined;
}) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const create = useCreateSquad();
  const draft = useDraftSquadFromText();

  const [stage, setStage] = useState<Stage>('intro');
  const [state, setState] = useState<ConciergeState>(INITIAL_STATE);
  const [text, setText] = useState('');
  /** What they actually sent, kept so it stays in the conversation. */
  const [submittedText, setSubmittedText] = useState('');
  /** Carried into the destination search when the opening line was a place. */
  const [seedQuery, setSeedQuery] = useState('');
  const [waited, setWaited] = useState(0);

  const abort = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const interpreting = stage === 'interpreting';
  const question = nextQuestion(state);
  const summary = summarise(state);
  const transcript = buildTranscript(state, submittedText);

  useEffect(() => {
    if (!interpreting) return;
    const started = Date.now();
    const tick = setInterval(() => setWaited(Math.floor((Date.now() - started) / 1000)), 500);
    return () => clearInterval(tick);
  }, [interpreting]);

  /**
   * Keeps the newest message in view, the way a messaging app does. Keyed on
   * the length of the conversation, so it only moves when something was said.
   */
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: reduced ? 'auto' : 'smooth' });
  }, [transcript.length, stage, reduced]);

  /** A closed assistant must not hold a request open. */
  useEffect(() => {
    if (open) return;
    abort.current?.abort();
    abort.current = null;
  }, [open]);

  /** Escape closes, as it does for every other overlay in the app. */
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose(state);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, state]);

  if (!open) return null;

  const atIntro = stage === 'intro';

  const orbPhase = interpreting
    ? 'thinking'
    : stage === 'confirm'
      ? 'success'
      : stage === 'asking'
        ? 'scanning'
        : 'idle';

  /**
   * Takes the destination straight from the opening box.
   *
   * This is what removed the double question. The first version asked people to
   * type where they were going and then - having understood perfectly well -
   * asked again in a separate step with a second search box. Choosing a
   * suggestion here answers the destination outright, so the next thing they
   * see is the *next* question.
   *
   * The coordinate is still Mapbox's and still theirs to pick; only the
   * redundant step is gone.
   */
  const pickOpeningPlace = (place: PickedPlace) => {
    setSubmittedText(place.label.split(',')[0] ?? place.label);
    setText('');
    setState((current) => answer(current, 'destination', place));
    setStage('asking');
  };

  /** The other path: a whole sentence, worth the one model call. */
  const readWholeTrip = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setSubmittedText(trimmed);
    setText('');
    setWaited(0);
    setStage('interpreting');
    abort.current = new AbortController();
    draft.mutate(
      { text: trimmed, near: near ?? null, signal: abort.current.signal },
      {
        onSuccess: (result) => {
          setState((current) => (result.understood ? applyExtraction(current, result) : current));
          if (!result.understood) setSeedQuery(trimmed);
          setStage('asking');
        },
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'aborted') return;
          // The assistant carries on by asking. A model that is down should
          // cost the shortcut, not the squad.
          setSeedQuery(trimmed);
          setStage('asking');
        },
      },
    );
  };

  const stopInterpreting = () => {
    abort.current?.abort();
    abort.current = null;
    draft.reset();
    setSeedQuery(submittedText);
    setStage('asking');
  };

  const submitSquad = () => {
    const { destination, meetingPoint } = state.slots;
    if (!destination || create.isPending) return;

    const departAt = combineDeparture(state.slots.departDate, state.slots.departTime);

    create.mutate(
      {
        name: summary.name || destination.label.split(',')[0] || 'Squad',
        type: summary.purpose,
        visibility: 'public',
        memberLimit: 4,
        destination: {
          lat: destination.lat,
          lng: destination.lng,
          label: destination.label,
          address: destination.address,
        },
        ...(college ? { college } : {}),
        ...(meetingPoint
          ? {
              meetingPoint: {
                lat: meetingPoint.lat,
                lng: meetingPoint.lng,
                label: meetingPoint.label,
                address: meetingPoint.address,
                ...(meetingPoint.featureType ? { featureType: meetingPoint.featureType } : {}),
                ...(meetingPoint.roadDistanceMetres === undefined
                  ? {}
                  : { roadDistanceMetres: meetingPoint.roadDistanceMetres }),
                ...(meetingPoint.source ? { source: meetingPoint.source } : {}),
                ...(meetingPoint.accuracyMetres === undefined
                  ? {}
                  : { accuracyMetres: meetingPoint.accuracyMetres }),
              },
            }
          : {}),
        ...(departAt ? { meetingAt: departAt.toISOString() } : {}),
      },
      { onSuccess: (squad) => router.replace(`/squads/${squad.id}`) },
    );
  };

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      /**
       * A screen, not a dialog box.
       *
       * The first version floated a rounded white card over a dimmed page,
       * which made the assistant look like a consent banner — a slab of chrome
       * sitting on top of the app rather than a place you had gone. Full-bleed
       * at every size, with the conversation scrolling and the controls docked,
       * is the shape people already know from a messaging app, and it leaves
       * room for the character to be big enough to actually read.
       *
       * z-[60] is the app's documented modal layer, above the dock (z-30), the
       * help widget (z-40/50) and the account menu (z-[55]) — so the bottom
       * navigation is genuinely gone rather than showing through.
       */
      className="fixed inset-0 z-[60] flex flex-col bg-canvas"
      role="dialog"
      aria-modal="true"
      aria-label="Spllit AI squad assistant"
    >
      {/*
        Depth without a container: a warm glow behind the character, sized in
        viewport units so it scales with the screen. This is what replaces the
        card — the eye reads a lit space rather than a floating rectangle.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[46vh]"
        style={{
          background:
            'radial-gradient(60% 60% at 50% 20%, rgba(255,122,61,0.20) 0%, rgba(255,122,61,0.05) 46%, transparent 72%)',
        }}
      />

      <header className="relative flex items-center justify-between gap-3 px-3 pt-3 sm:px-5 sm:pt-4">
        {stage === 'confirm' ? (
          <button
            type="button"
            onClick={() => setStage('asking')}
            className="rounded-full p-2 text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink"
            aria-label="Back to questions"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </button>
        ) : (
          <span className="h-9 w-9" />
        )}

        <span className="text-[13px] font-semibold text-ink">Spllit AI</span>

        <button
          type="button"
          onClick={() => onClose(state)}
          aria-label="Close assistant"
          className="rounded-full p-2 text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </header>

      {atIntro ? (
        /*
          Everything centred while there is nothing to show.

          An empty transcript with the input welded to the bottom of the screen
          left half a page of blank between the greeting and the only thing you
          could do, which is what made it feel unfinished. The character, the
          question and the box belong together until there is a conversation to
          hold them apart.
        */
        <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-10 sm:px-5">
          <SpllitAiOrb phase={orbPhase} size={150} />

          <p className="mt-2 font-display text-[23px] font-semibold tracking-[-0.02em] text-ink">
            Hey! Let&apos;s plan it.
          </p>
          <p className="mt-1 max-w-xs text-center text-[13.5px] leading-relaxed text-ink-muted">
            Tell me about your trip, or just say where you are going.
          </p>

          <div className="mt-5 w-full max-w-md">
            {/*
              One box, and it is the real place search.

              Typing shows suggestions immediately and choosing one *is* the
              answer, so there is no second screen asking the same thing. A whole
              sentence has no useful suggestions, so the button below appears
              instead and sends it to be read.
            */}
            <PlacePicker
              label="Where are you going?"
              value={null}
              onChange={(place) => place && pickOpeningPlace(place)}
              onQueryChange={setText}
              placeholder="Taramani, or tell me the whole trip..."
              proximity={near ?? null}
            />

            {needsInterpretation(text) ? (
              <Button className="mt-2.5 w-full" onClick={readWholeTrip}>
                Read my whole trip
              </Button>
            ) : (
              <button
                type="button"
                onClick={() => setStage('asking')}
                className="mt-2.5 w-full rounded-lg py-2 text-[13px] font-medium text-ink-subtle transition-colors hover:text-ink"
              >
                Skip &mdash; I&apos;ll answer questions
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* The conversation. Scrolls; the controls below do not. */}
          <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-5">
            <div className="mx-auto w-full max-w-md">
              <div className="flex flex-col items-center pt-1 text-center">
                <SpllitAiOrb phase={orbPhase} size={104} />
              </div>

              <ul className="mt-3 space-y-2">
                {transcript.map((turn) => (
                  <Bubble key={turn.id} turn={turn} reduced={Boolean(reduced)} />
                ))}

                {/* The live question, in the same bubble as every answered one,
                    so what is being asked never looks like a different kind of
                    object from what has already been agreed. */}
                {stage === 'asking' && question ? (
                  <Bubble
                    turn={{ id: 'live', role: 'ai', text: question.prompt }}
                    reduced={Boolean(reduced)}
                  />
                ) : null}

                {interpreting ? (
                  <Bubble
                    turn={{
                      id: 'thinking',
                      role: 'ai',
                      text: waited >= 8 ? 'Still reading...' : 'Reading your trip...',
                    }}
                    reduced={Boolean(reduced)}
                    pending
                  />
                ) : null}

                {stage === 'confirm' ? (
                  <Bubble
                    turn={{ id: 'ready', role: 'ai', text: 'Here it is - happy with this?' }}
                    reduced={Boolean(reduced)}
                  />
                ) : null}
              </ul>

              {stage === 'confirm' ? <ConfirmCard summary={summary} /> : null}
            </div>
          </div>

          {/*
            Docked controls, like a chat composer: whatever is being asked, the
            thing you answer with is always in the same place no matter how long
            the conversation gets.
          */}
          <div className="relative border-t border-line bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm sm:px-5">
            <div className="mx-auto w-full max-w-md">
              {interpreting ? (
                <Button variant="secondary" className="w-full" onClick={stopInterpreting}>
                  Skip this and answer questions
                </Button>
              ) : stage === 'confirm' ? (
                <ConfirmActions
                  onCreate={submitSquad}
                  creating={create.isPending}
                  error={create.isError ? create.error : null}
                  onEdit={() => setStage('asking')}
                />
              ) : question ? (
                <QuestionStep
                  key={question.slot}
                  question={question}
                  state={state}
                  near={near ?? null}
                  seedQuery={question.slot === 'destination' ? seedQuery : ''}
                  onAnswer={(slot, value) => {
                    setSeedQuery('');
                    setState((current) => answer(current, slot, value as never));
                  }}
                  onSkip={(slot) => setState((current) => skip(current, slot))}
                  canReview={isReady(state)}
                  onReview={() => setStage('confirm')}
                />
              ) : (
                <Button
                  className="w-full"
                  onClick={() => setStage('confirm')}
                  disabled={!isReady(state)}
                >
                  Review my squad
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}

/**
 * One line of the conversation.
 *
 * The assistant on the left, the person on the right — the arrangement every
 * messaging app uses, so nobody has to learn who is who. Answers read back as
 * the person would say them ("Tomorrow", "Taramani") rather than as they are
 * stored, because this is a record of a conversation and not a dump of the
 * state behind it.
 */
function Bubble({
  turn,
  reduced,
  pending,
}: {
  turn: ChatTurn;
  reduced: boolean;
  pending?: boolean;
}) {
  const mine = turn.role === 'user';
  return (
    <motion.li
      initial={reduced ? false : { opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className={cn('flex', mine ? 'justify-end' : 'justify-start')}
    >
      <span
        className={cn(
          'inline-block max-w-[85%] rounded-2xl px-3.5 py-2 text-[14px] leading-snug shadow-soft',
          mine ? 'rounded-br-md bg-brand text-white' : 'rounded-bl-md bg-surface text-ink',
        )}
      >
        {turn.text}
        {pending ? <span className="ml-1 inline-block animate-pulse">…</span> : null}
      </span>
    </motion.li>
  );
}

/** Quick date choices, so the common answers never open a calendar. */
function dateChoices(): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  for (let offset = 0; offset < 4; offset += 1) {
    const when = new Date();
    when.setDate(when.getDate() + offset);
    out.push({
      label:
        offset === 0
          ? 'Today'
          : offset === 1
            ? 'Tomorrow'
            : when.toLocaleDateString(undefined, { weekday: 'long' }),
      value: localDateKey(when),
    });
  }
  return out;
}

const TIME_CHOICES = [
  { label: 'Morning · 9:00', value: '09:00' },
  { label: 'Midday · 12:00', value: '12:00' },
  { label: 'Afternoon · 15:00', value: '15:00' },
  { label: 'Evening · 18:00', value: '18:00' },
];

function QuestionStep({
  question,
  state,
  near,
  seedQuery,
  onAnswer,
  onSkip,
  canReview,
  onReview,
}: {
  question: Question;
  state: ConciergeState;
  near: LngLat | null;
  seedQuery: string;
  onAnswer: (slot: Question['slot'], value: unknown) => void;
  onSkip: (slot: Question['slot']) => void;
  canReview: boolean;
  onReview: () => void;
}) {
  const { destination } = state.slots;

  return (
    <div className="space-y-2.5">
      {question.kind === 'place' ? (
        <PlacePicker
          label={question.prompt}
          value={null}
          onChange={(place) => place && onAnswer(question.slot, place)}
          placeholder={question.slot === 'destination' ? 'Search destination…' : 'Search a place…'}
          /* Ranked against where they are, or where they are starting from once
             that is known — the same rule the manual form follows. */
          proximity={state.slots.origin ? [state.slots.origin.lng, state.slots.origin.lat] : near}
          /* Where you are is a plausible starting point and never a plausible
             destination, so the offer is made for one and not the other. */
          allowCurrentLocation={question.slot === 'origin'}
          {...(seedQuery ? { initialQuery: seedQuery } : {})}
        />
      ) : null}

      {question.kind === 'date' ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {dateChoices().map((choice) => (
              <ChoiceButton
                key={choice.value}
                onClick={() => onAnswer('departDate', choice.value)}
                label={choice.label}
              />
            ))}
          </div>
          <DateTimePicker
            value={null}
            onChange={(when) => when && onAnswer('departDate', localDateKey(when))}
          />
        </div>
      ) : null}

      {question.kind === 'time' ? (
        <div className="grid grid-cols-2 gap-2">
          {TIME_CHOICES.map((choice) => (
            <ChoiceButton
              key={choice.value}
              onClick={() => onAnswer('departTime', choice.value)}
              label={choice.label}
            />
          ))}
          <input
            type="time"
            aria-label="Departure time"
            onChange={(event) => {
              const value = event.target.value;
              if (/^\d{2}:\d{2}$/.test(value)) onAnswer('departTime', value);
            }}
            className="col-span-2 h-11 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand"
          />
        </div>
      ) : null}

      {question.kind === 'purpose' ? (
        <div className="grid grid-cols-2 gap-2">
          {SQUAD_PURPOSES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onAnswer('purpose', option.value as SquadType)}
              className={cn(
                'flex min-h-[48px] items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5',
                'text-[14px] font-medium text-ink transition-colors hover:border-brand hover:bg-surface-sunken',
              )}
            >
              <span aria-hidden className="text-[17px]">
                {option.icon}
              </span>
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {question.kind === 'meeting' ? (
        <div className="space-y-2">
          {destination ? (
            <ChoiceButton
              onClick={() => onAnswer('meetingPoint', destination)}
              label={`Meet at ${destination.label.split(',')[0]}`}
              icon={<MapPin className="h-4 w-4 text-ink-subtle" aria-hidden />}
            />
          ) : null}
          <PlacePicker
            label="Meeting point"
            value={null}
            onChange={(place) => place && onAnswer('meetingPoint', place)}
            placeholder="Search a meeting point…"
            /* Biased to the destination: a meeting point is usually near where
               the squad is going, not where the leader is standing. */
            proximity={destination ? [destination.lng, destination.lat] : near}
            allowCurrentLocation
          />
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 pt-0.5">
        {question.skippable ? (
          <button
            type="button"
            onClick={() => onSkip(question.slot)}
            className="rounded-lg py-1.5 text-[13px] font-medium text-ink-subtle transition-colors hover:text-ink"
          >
            Skip this
          </button>
        ) : (
          <span />
        )}

        {/* Offered the moment a destination exists, so nobody is walked through
            questions they do not care about to reach the button. */}
        {canReview ? (
          <button
            type="button"
            onClick={onReview}
            className="rounded-lg py-1.5 text-[13px] font-medium text-brand transition-opacity hover:opacity-80"
          >
            That&apos;s enough — review
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ChoiceButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 py-2',
        'text-[14px] font-medium text-ink transition-colors hover:border-brand hover:bg-surface-sunken',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * The ticket.
 *
 * Everything on it is read back from the slots, so the user confirms what will
 * be sent rather than a summary of it. A defaulted meeting point says so — a
 * card that quietly presents a fallback as a decision is how people end up
 * somewhere they never agreed to meet.
 */
function ConfirmCard({ summary }: { summary: ReturnType<typeof summarise> }) {
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
      <div className="border-b border-dashed border-line px-4 py-3 text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-subtle">
          Your squad
        </p>
        <p className="mt-1 font-display text-[18px] font-semibold tracking-[-0.02em] text-ink">
          {summary.name || 'Untitled squad'}
        </p>
      </div>

      <div className="space-y-3 px-4 py-4 text-[13.5px]">
        <div className="flex items-start gap-2.5">
          <span aria-hidden className="text-[15px]">
            {purposeIcon(summary.purpose)}
          </span>
          <span className="text-ink">{purposeLabel(summary.purpose)}</span>
        </div>

        <div className="flex items-start gap-2.5">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" aria-hidden />
          <div className="min-w-0">
            {summary.originLabel ? (
              <p className="text-ink-muted">
                {summary.originLabel} <span aria-hidden>→</span>{' '}
                <span className="font-medium text-ink">{summary.destinationLabel}</span>
              </p>
            ) : (
              <p className="font-medium text-ink">{summary.destinationLabel}</p>
            )}
            {summary.meetingLabel ? (
              <p className="mt-0.5 text-[12.5px] text-ink-muted">
                Meet at <span className="text-ink">{summary.meetingLabel}</span>
                {summary.meetingIsDefault ? (
                  <span className="text-ink-subtle"> · default</span>
                ) : null}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <span aria-hidden className="text-[15px]">
            🕘
          </span>
          {summary.departAt ? (
            <span className="text-ink">
              {summary.departAt.toLocaleString(undefined, {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          ) : (
            <span className="text-ink-subtle">No departure time</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfirmActions({
  onCreate,
  creating,
  error,
  onEdit,
}: {
  onCreate: () => void;
  creating: boolean;
  error: unknown;
  onEdit: () => void;
}) {
  return (
    <div>
      <Button className="w-full" onClick={onCreate} loading={creating}>
        Create squad
      </Button>
      <button
        type="button"
        onClick={onEdit}
        className="mt-1.5 w-full rounded-lg py-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink"
      >
        Change something
      </button>

      {error ? (
        <p role="alert" className="mt-1.5 text-center text-[13px] text-danger">
          {error instanceof Error ? error.message : "Couldn't create the squad."}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Small floating launcher.
 *
 * Stacked *above* the support widget rather than beside it. Both are round
 * buttons pinned to the same corner at the same z-index, so the first version
 * landed exactly on top of the black "?" — two help affordances fighting for
 * one spot. The offsets below clear its 48 px button plus its own inset at each
 * breakpoint.
 */
export function AiConciergeLauncher({
  onOpen,
  isOpen,
  everOpened,
  hasDestination,
  isTyping,
}: {
  onOpen: () => void;
  isOpen: boolean;
  everOpened: boolean;
  hasDestination: boolean;
  isTyping: boolean;
}) {
  const reduced = useReducedMotion();
  const [seconds, setSeconds] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  /**
   * Counts how long they have been on this screen.
   *
   * Ticks every second only until a nudge could no longer be shown, so a page
   * left open in a background tab is not running a timer for an hour to decide
   * something that was settled in the first minute.
   */
  const settled = everOpened || dismissed;
  useEffect(() => {
    if (settled) return;
    const tick = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(tick);
  }, [settled]);

  const nudge = pickNudge({
    secondsOnPage: seconds,
    everOpened,
    dismissed,
    isOpen,
    hasDestination,
    isTyping,
  });

  return (
    <div
      className={cn(
        'fixed z-40 flex flex-col items-end gap-2',
        // The support widget sits at bottom-24 on phones and bottom-6 from lg.
        'bottom-[10.5rem] right-4 lg:bottom-[5.5rem] lg:right-6',
      )}
    >
      <AnimatePresence>
        {nudge ? (
          <motion.div
            key={nudge.id}
            initial={reduced ? false : { opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="flex max-w-[15rem] items-start gap-1.5 rounded-2xl rounded-br-md border border-line bg-surface px-3 py-2 shadow-float"
          >
            {/* The bubble opens the assistant, so the offer and the thing it
                offers are the same target — nobody has to read it and then
                aim at a different button. */}
            <button
              type="button"
              onClick={onOpen}
              className="text-left text-[13px] leading-snug text-ink"
            >
              {nudge.text}
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Not now"
              className="-mr-1 -mt-0.5 shrink-0 rounded-full p-1 text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex items-center gap-2 rounded-full border border-line bg-surface py-2 pl-2 pr-4 shadow-float',
          'transition-transform duration-snap hover:scale-105 active:scale-95',
        )}
      >
        <SpllitAiOrb phase="idle" size={30} />
        <span className="text-[13px] font-medium text-ink">Need help?</span>
      </button>
    </div>
  );
}
