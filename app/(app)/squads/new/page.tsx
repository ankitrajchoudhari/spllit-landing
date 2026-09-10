'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Flag, Map as MapIcon, MapPin, User, Users } from 'lucide-react';

import { Button, ButtonLink } from '@/components/ui/button';
import { Input, Field } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Segmented } from '@/components/ui/tabs';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { PlacePicker, type PickedPlace } from '@/components/shared/place-picker';
import { AiConcierge, AiConciergeLauncher } from '@/components/shared/ai-concierge';
import { VerifyInstituteBanner } from '@/components/shared/verify-institute';
import { useCreateSquad, useMySquads } from '@/lib/hooks/queries';
import { useGeolocation } from '@/lib/hooks/use-geolocation';
import { useAuth } from '@/lib/auth/auth-provider';
import { SQUAD_PURPOSES, isSquadLive, purposeLabel, suggestSquadName } from '@/lib/squad-purpose';
import { cn, formatDistance, haversine } from '@/lib/utils';
import { combineDeparture, type ConciergeState } from '@/lib/ai-concierge';
import {
  SQUAD_CAPACITIES,
  meetingPointHref,
  readSquadDraft,
  type SquadVisibility,
} from '@/lib/squad-draft';
import type { LngLat, SquadType } from '@/types';

function startOfTomorrow(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
}

function inOneHour(): Date {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 1);
  return date;
}

function NewSquadForm({ searchParams }: { searchParams: URLSearchParams }) {
  const router = useRouter();
  const { profile } = useAuth();
  const { center } = useGeolocation();
  const create = useCreateSquad();
  const mySquads = useMySquads();

  /**
   * The squad this user already leads, if any. Only leadership blocks creating
   * another — being a member of somebody else's squad does not.
   */
  const activeSquad = (mySquads.data ?? []).find(
    (squad) => squad.viewerRole === 'leader' && isSquadLive(squad.status),
  );

  /**
   * Prefilled from the search that led here, and from the draft that comes back
   * from the map picker.
   *
   * The empty results state links to this screen with the destination and
   * departure already in the query string, and this screen ignored them —
   * so someone who had just typed "Fortune Tower" and picked a time was asked
   * for both again, one tap later. Answering the same question twice is how a
   * flow starts feeling careless.
   *
   * The same reasoning is why every *other* answer is round-tripped too:
   * choosing a meeting point is a different route, so anything not in the URL
   * would be gone by the time the user came back holding a pin.
   *
   * `useState(initialiser)` rather than an effect: the values are known on the
   * first render, and setting them afterwards would flash an empty form and
   * fight anything the user had already changed.
   */
  const draft = readSquadDraft(searchParams);

  const [destination, setDestination] = useState<PickedPlace | null>(() => draft.destination);
  const [name, setName] = useState(() => draft.name ?? '');
  /**
   * Once the leader edits the name we stop regenerating it. Without this,
   * changing the purpose afterwards would silently discard what they typed.
   *
   * A `name` in the URL means exactly that edit already happened — the
   * suggestion is never written there — so it restores as touched.
   */
  const [nameTouched, setNameTouched] = useState(() => draft.name !== null);
  const [purpose, setPurpose] = useState<SquadType>(() => draft.purpose ?? 'college');
  const [departAt, setDepartAt] = useState<Date | null>(() => {
    if (!draft.departAt) return null;
    const when = new Date(draft.departAt);
    return Number.isNaN(when.getTime()) ? null : when;
  });
  const [capacity, setCapacity] = useState<number>(() => draft.capacity ?? 4);
  const [visibility, setVisibility] = useState<SquadVisibility>(
    () => draft.visibility ?? 'public',
  );
  const [meetingPoint, setMeetingPoint] = useState<PickedPlace | null>(
    () => draft.meetingPoint,
  );

  /**
   * A starting point the assistant read out of a sentence.
   *
   * Separate from `draft.origin`, which comes from the URL, and preferred over
   * it: someone who has just said "from Velachery" means that trip, not the
   * search that happened to bring them here. It has no input of its own — it
   * only biases destination search.
   */
  const [aiOrigin, setAiOrigin] = useState<LngLat | null>(null);

  const suggestedName = destination ? suggestSquadName(destination.label, purpose) : '';
  const effectiveName = nameTouched ? name : suggestedName;

  /** Meeting point offset, shown so the leader can sanity-check the pin. */
  const meetingOffset = useMemo(() => {
    if (!destination || !meetingPoint) return null;
    return haversine([destination.lng, destination.lat], [meetingPoint.lng, meetingPoint.lat]);
  }, [destination, meetingPoint]);

  const applyDestination = (place: PickedPlace | null) => {
    setDestination(place);
    // Keep the suggestion live until the leader takes the name over.
    if (!nameTouched) setName(place ? suggestSquadName(place.label, purpose) : '');
  };

  const applyPurpose = (next: SquadType) => {
    setPurpose(next);
    if (!nameTouched && destination) setName(suggestSquadName(destination.label, next));
  };

  /** Whether the assistant is on screen. */
  const [conciergeOpen, setConciergeOpen] = useState(false);
  /**
   * Whether it has ever been opened on this visit.
   *
   * Separate from `conciergeOpen` because it never goes back to false: it is
   * what stops the assistant offering help again to someone who has already
   * taken it up once and closed it. Opening is an answer.
   */
  const [conciergeEverOpened, setConciergeEverOpened] = useState(false);

  /**
   * Takes back everything the assistant collected.
   *
   * Closing it must never cost an answer: someone who told it three things and
   * then decided they would rather use the form finds those three things
   * already filled in. Only non-empty slots are copied, so closing an assistant
   * that learned nothing changes nothing.
   */
  const closeConcierge = (result: ConciergeState) => {
    setConciergeOpen(false);

    const { destination: dest, origin, purpose: chosen, meetingPoint: meet } = result.slots;
    if (dest) applyDestination(dest);
    if (origin) setAiOrigin([origin.lng, origin.lat]);
    if (chosen) applyPurpose(chosen);
    if (meet) setMeetingPoint(meet);

    const when = combineDeparture(result.slots.departDate, result.slots.departTime);
    if (when) setDepartAt(when);
  };

  const canSubmit = Boolean(destination) && effectiveName.trim().length >= 2;

  /**
   * Link out to the full-screen map picker, carrying everything answered so
   * far. Built from live form state rather than from the params this page was
   * opened with, so edits made since arriving survive the round trip.
   *
   * The name is only carried once it has been typed over — the suggestion
   * regenerates from destination and purpose on the way back, so writing it
   * into the URL would freeze a name the leader never chose.
   */
  const pickMeetingPointHref = meetingPointHref({
    // Carried through so the origin survives the map round trip and destination
    // search still ranks against it on the way back.
    origin: draft.origin,
    originLabel: draft.originLabel,
    destination,
    departAt: departAt?.toISOString() ?? null,
    name: nameTouched ? (name.trim() || null) : null,
    purpose,
    capacity,
    visibility,
    meetingPoint,
  });

  const submit = () => {
    if (!destination || !canSubmit) return;
    create.mutate(
      {
        name: effectiveName.trim(),
        type: purpose,
        visibility,
        memberLimit: capacity,
        destination: {
          lat: destination.lat,
          lng: destination.lng,
          label: destination.label,
          address: destination.address,
        },
        // Deliberately not sent. The server reads the college from the
        // creator's own row, because a client-supplied one both mis-files
        // squads and would let anyone post into another institute's feed.
        ...(meetingPoint
          ? {
              meetingPoint: {
                lat: meetingPoint.lat,
                lng: meetingPoint.lng,
                label: meetingPoint.label,
                /**
                 * The address was being dropped here, and only here.
                 *
                 * The picker resolves it, `/location` shows it on the
                 * confirmation card, the URL draft carries it back — and then
                 * the create call sent the label alone, so the street everybody
                 * had just agreed to meet on was thrown away at the last step
                 * while the destination beside it kept its own. `GeoPoint` has
                 * carried an `address` all along; nothing needed to change but
                 * this line.
                 */
                address: meetingPoint.address,
                /**
                 * What the coordinate is, how it was chosen, and how well it is
                 * known. Each omitted when it was never established, so the
                 * squad carries no claim the picker could not support — and
                 * `precision` is deliberately not among them: it is derived
                 * from `featureType` and belongs to the view, not the record.
                 */
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

  /**
   * The form is not rendered at all while the user already leads a squad.
   *
   * A disabled button was not enough — the page still invited them to fill in
   * a destination, a purpose and a departure time before discovering none of it
   * could be submitted. The API rejects it either way; this stops the wasted
   * effort.
   */
  if (activeSquad) {
    const where = activeSquad.destination?.label?.split(',')[0] ?? activeSquad.name;
    return (
      <div className="mx-auto max-w-lg space-y-6 pb-8">
        <div className="flex items-center gap-3">
          <Link
            href="/squads"
            aria-label="Back to squads"
            className="rounded-md p-2 text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-display text-[22px] font-semibold tracking-[-0.025em] text-ink">
            Start a squad
          </h1>
        </div>

        <div className="rounded-xl border border-line bg-surface p-6 shadow-soft">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-warning-muted text-warning">
            <Users className="h-5 w-5" />
          </span>
          <h2 className="mt-4 font-display text-[19px] font-semibold tracking-[-0.02em] text-ink">
            You already lead a squad
          </h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">
            You are leading <span className="font-medium text-ink">{where}</span>. One
            squad at a time — running two splits the people who could have
            travelled together, and leaves both groups short.
          </p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">
            Mark it done or cancel it from the squad page, and this opens again.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`/squads/${activeSquad.id}`}>
              <Button size="sm">Open {where}</Button>
            </Link>
            <Link href="/squads">
              <Button size="sm" variant="secondary">
                Back to squads
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <Link
          href="/squads"
          aria-label="Back to squads"
          className="rounded-md p-2 text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="font-display text-[22px] font-semibold tracking-[-0.025em] text-ink">
          Start a squad
        </h1>
      </div>

      {/* Renders only when unverified, and self-hides the moment it succeeds.
          Placed above the form rather than beside the disabled button: finding
          out you are blocked *after* filling in six fields is the worst
          possible moment to be told. */}
      <VerifyInstituteBanner />

      {/* Step 1 — destination leads, because it is what people search for. */}
      <div>
        {/* Not a <label>: PlacePicker owns its own input id and takes its
            accessible name via `label`, so pointing htmlFor at it would
            reference an element that does not exist. The visible heading and
            the accessible name are kept identical instead. */}
        {/*
          "Where is everyone going?" read as a question about other people —
          as though the screen were searching for a group that already exists.
          The leader is describing their own trip, which others may then join.
        */}
        <p className="mb-2 font-display text-[17px] font-semibold tracking-[-0.02em] text-ink">
          Where are you going?
        </p>
        <PlacePicker
          label="Where are you going?"
          value={destination}
          onChange={applyDestination}
          placeholder="Search destination…"
          /* Rank against the trip's own starting point when the search that led
             here had one; the device position is only the fallback. */
          proximity={aiOrigin ?? draft.origin ?? center}
        />
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
          Choose the destination everyone in your Squad will travel to. Everything
          after this is optional.
        </p>

        {/*
          Someone who opened the map picker directly, with no squad in progress,
          arrives back here holding a meeting point and nothing else. The rest
          of the form is still gated behind a destination, so without this the
          pin they just chose would be held in state and shown nowhere — which
          reads exactly like having lost it.
        */}
        {meetingPoint && !destination ? (
          <p className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-surface-sunken px-3 py-2 text-[12.5px] leading-relaxed text-ink-muted">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-subtle" aria-hidden />
            <span className="min-w-0">
              Meeting point saved:{' '}
              <span className="font-medium text-ink">{meetingPoint.label.split(',')[0]}</span>.
              Pick a destination to carry on.
            </span>
          </p>
        ) : null}
      </div>

      {destination ? (
        <div className="space-y-5">
          {/* Step 2 — when. A trip is defined by where and when; both are asked
              before any refinement, so the shape of the plan is settled first. */}
          <div>
            <span className="mb-2 block text-[13px] font-medium text-ink">
              When are you leaving?
            </span>
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDepartAt(inOneHour())}
                className="min-h-[38px] rounded-full border border-line px-3.5 py-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
              >
                Within the hour
              </button>
              <button
                type="button"
                onClick={() => setDepartAt(startOfTomorrow())}
                className="min-h-[38px] rounded-full border border-line px-3.5 py-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
              >
                Tomorrow morning
              </button>
              {departAt ? (
                <button
                  type="button"
                  onClick={() => setDepartAt(null)}
                  className="min-h-[38px] rounded-full px-3.5 py-1.5 text-[13px] font-medium text-ink-subtle transition-colors hover:text-ink"
                >
                  Clear
                </button>
              ) : null}
            </div>
            {/* Same picker as rides and events — one calendar across the app,
                so "when are you leaving" never looks like a different question
                depending on which screen asked it. */}
            <DateTimePicker value={departAt} onChange={setDepartAt} />
          </div>

          {/* Step 4 — name, pre-filled from destination + purpose. */}
          <Field label="Squad name" hint="Auto-named. Edit if you like." htmlFor="squad-name">
            <Input
              id="squad-name"
              value={effectiveName}
              onChange={(e) => {
                setNameTouched(true);
                setName(e.target.value);
              }}
            />
          </Field>

          {/**
           * Who this squad will actually reach.
           *
           * The name is free text and the audience is the creator's college,
           * and nothing said so — which is how a squad called "Chennai
           * Institute of Technology College Squad" came to be listed to IIT
           * Madras students and to nobody at CIT. Naming it after another
           * institute is a reasonable thing to do; being surprised by who sees
           * it is not.
           */}
          {profile?.college ? (
            <p className="-mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed text-ink-subtle">
              <Users className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              <span>
                Visible to <span className="font-medium text-ink-muted">{profile.college}</span>{' '}
                students, wherever the name points. Change your college in your profile to
                list elsewhere.
              </span>
            </p>
          ) : null}

          {/* Step 3 — purpose. */}
          <div>
            <span className="mb-2 block text-[13px] font-medium text-ink">What&apos;s the trip for?</span>
            <div className="flex flex-wrap gap-2">
              {SQUAD_PURPOSES.map((option) => {
                const active = option.value === purpose;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => applyPurpose(option.value)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5',
                      'text-[13px] font-medium transition-colors',
                      active
                        ? 'border-transparent bg-brand text-white'
                        : 'border-line text-ink-muted hover:bg-surface-sunken hover:text-ink',
                    )}
                  >
                    {/* Decorative: the label already names the purpose, so the
                        icon must not be announced twice. */}
                    <span aria-hidden="true">{option.icon}</span>
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 5 — meeting point. Never blank: skipping the picker means the
              destination itself, decided server-side so every client agrees. */}
          <Field
            label="Meeting point"
            hint={
              meetingPoint
                ? undefined
                : `Defaults to ${destination.label.split(',')[0]} if you skip it.`
            }
          >
            <PlacePicker
              label="Meeting point"
              value={meetingPoint}
              onChange={setMeetingPoint}
              placeholder="Where do you regroup first?"
              /* Bias suggestions to the destination, not the leader's current
                 position — the meeting point is usually near where they are
                 going, and often nowhere near where they are standing. */
              proximity={[destination.lng, destination.lat]}
              /* Offered even though suggestions are biased to the destination:
                 a leader setting off from where they are standing means exactly
                 that, and it is the one place they cannot mistype. */
              allowCurrentLocation
            />

            {/*
              Search and map are both offered, because they answer the question
              differently. A named landmark ("Velachery Bus Stand") is fastest
              to type; a specific gate, a corner or a stretch of kerb has no
              name to type at all, and pointing at it is the only way to say it.
              Dropping the search box in favour of the map would have made the
              common case slower.
            */}
            <ButtonLink
              href={pickMeetingPointHref}
              variant="secondary"
              className="mt-2.5 w-full"
            >
              <MapIcon className="h-4 w-4" aria-hidden />
              {meetingPoint ? 'Change meeting point on map' : 'Choose meeting point on map'}
            </ButtonLink>
          </Field>

          {/* Step 6 — capacity. */}
          <div>
            <span className="mb-2 block text-[13px] font-medium text-ink">
              How many people can join?
            </span>
            <div className="flex flex-wrap gap-2">
              {SQUAD_CAPACITIES.map((size) => {
                const active = size === capacity;
                return (
                  <button
                    key={size}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCapacity(size)}
                    /* 44px, not 40: this is a row of small round targets and
                       the old h-10 sat under the minimum on every phone. */
                    className={cn(
                      'h-11 w-11 rounded-full border text-[13px] font-medium transition-colors',
                      active
                        ? 'border-transparent bg-brand text-white'
                        : 'border-line text-ink-muted hover:bg-surface-sunken hover:text-ink',
                    )}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="flex gap-0.5" aria-hidden="true">
                {Array.from({ length: capacity }, (_, index) => (
                  <User
                    key={index}
                    className={cn('h-4 w-4', index === 0 ? 'text-brand' : 'text-ink-subtle')}
                  />
                ))}
              </span>
              <span className="text-[13px] text-ink-muted">
                {capacity} people{' '}
                <span className="text-ink-subtle">(you + {capacity - 1} others)</span>
              </span>
            </div>
          </div>

          {/* Step 7 — visibility. */}
          <div>
            <span className="mb-2 block text-[13px] font-medium text-ink">
              Who can see your Squad?
            </span>
            <Segmented
              value={visibility}
              onChange={setVisibility}
              items={[
                { value: 'public', label: 'Public' },
                { value: 'invite', label: 'Invite only' },
              ]}
            />
            {/*
              Invite-only gets a warning, not a caption.
              It excludes the squad from search entirely, which the leader
              cannot see from inside their own squad — it looks perfectly
              healthy to them while returning nothing for everyone else. Two
              accounts testing this read it as discovery being broken. The
              consequence has to be stated in the words that describe the
              symptom, not as a feature description.
            */}
            {visibility === 'public' ? (
              <p className="mt-2 text-[12px] text-ink-subtle">
                Nearby people heading the same way can find and join this squad.
              </p>
            ) : (
              <p className="mt-2 rounded-lg border border-warning/40 bg-warning-muted px-3 py-2 text-[12px] leading-relaxed text-ink-muted">
                <span className="font-medium text-ink">
                  This squad will not appear in anyone&apos;s search.
                </span>{' '}
                It opens only to people you send the link or code to. You can make it
                public later from the squad.
              </p>
            )}
          </div>

          {/* Step 8 — live preview of the card others will see. */}
          <div>
            <span className="mb-2 block text-[13px] font-medium text-ink">Preview</span>
            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-[17px] font-semibold tracking-[-0.02em] text-ink">
                    {destination.label.split(',')[0]}
                  </p>
                  <p className="truncate text-[13px] text-ink-muted">
                    {effectiveName.trim() || 'Untitled squad'}
                  </p>
                </div>
                <Badge tone={visibility === 'public' ? 'brand' : 'neutral'}>
                  {visibility === 'public' ? 'Public' : 'Invite'}
                </Badge>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />1 / {capacity}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Flag className="h-3.5 w-3.5" />
                  {purposeLabel(purpose)}
                </span>
                {departAt ? (
                  <span>
                    {departAt.toLocaleDateString(undefined, { weekday: 'short' })}{' '}
                    {departAt.toLocaleTimeString(undefined, {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                ) : (
                  <span className="text-ink-subtle">No departure time</span>
                )}
              </div>

              <div className="mt-3 flex items-start gap-1.5 border-t border-line pt-3 text-[13px]">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                {meetingPoint ? (
                  <span className="text-ink-muted">
                    Meet at <span className="text-ink">{meetingPoint.label.split(',')[0]}</span>
                    {meetingOffset !== null ? (
                      <span className="text-ink-subtle">
                        {' '}
                        · {formatDistance(meetingOffset)} from {destination.label.split(',')[0]}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  /* Mirrors the server-side default so the preview never shows
                     a squad in a state the backend will not actually create. */
                  <span className="text-ink-muted">
                    Meet at <span className="text-ink">{destination.label.split(',')[0]}</span>
                    <span className="text-ink-subtle"> · default</span>
                  </span>
                )}
              </div>

              <p className="mt-3 text-[12px] text-ink-subtle">
                {profile?.name ? `${profile.name} leads` : 'You lead'} this squad.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/*
        Step 9 — CTA, stuck to the bottom of the viewport on phones.

        The floating dock is `fixed` at the bottom of every screen, so a button
        in normal flow at the end of a long form sits underneath it exactly when
        the form is complete and the button matters most. Sticky keeps it above
        the fold; `bottom` clears the dock's 56px panel, its 8px offset and the
        safe-area inset. From `sm` up there is room for it to sit inline.

        The negative margins let the bar bleed to the edges of the shell's
        horizontal padding so its backdrop covers the full width, rather than
        leaving two strips of scrolling content beside it.
      */}
      <div
        className={cn(
          'sticky z-20 -mx-4 border-t border-line bg-canvas px-4 py-3 backdrop-blur-sm sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none',
          'bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:bottom-auto sm:static',
        )}
      >
        <Button
          size="lg"
          className="w-full"
          disabled={!canSubmit}
          loading={create.isPending}
          onClick={submit}
        >
          Create squad
        </Button>

        {create.isError ? (
          <p role="alert" className="mt-2 text-[13px] text-danger">
            {create.error instanceof Error ? create.error.message : "Couldn't create the squad."}
          </p>
        ) : null}
      </div>

      {/*
        The assistant is offered, never imposed. The form above works exactly as
        it always has for anyone who ignores this, which is why the launcher is
        a small corner button rather than a step in the flow.
      */}
      <AiConciergeLauncher
        onOpen={() => {
          setConciergeEverOpened(true);
          setConciergeOpen(true);
        }}
        isOpen={conciergeOpen}
        everOpened={conciergeEverOpened}
        hasDestination={Boolean(destination)}
        /* Never speaks over someone mid-answer: the name field is the one
           place on this form where a bubble would land on live keystrokes. */
        isTyping={nameTouched && effectiveName.trim().length > 0 && !destination}
      />
      <AiConcierge
        open={conciergeOpen}
        onClose={closeConcierge}
        near={aiOrigin ?? draft.origin ?? center}
        college={profile?.college}
      />
    </div>
  );
}

/**
 * `useSearchParams` needs a Suspense boundary during prerender. The fallback
 * mirrors the form's shell so the page does not jump when it resolves.
 */
export default function NewSquadPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-lg space-y-3 px-1 py-6">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      }
    >
      <NewSquadParams />
    </Suspense>
  );
}

function NewSquadParams() {
  const params = useSearchParams();
  return <NewSquadForm searchParams={new URLSearchParams(params.toString())} />;
}
