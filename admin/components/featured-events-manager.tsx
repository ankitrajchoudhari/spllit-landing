'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronRight, ExternalLink, ImagePlus, Loader2, Plus, Trash2 } from 'lucide-react';

import { api, apiUpload, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button, Card, Input } from '@/components/ui/primitives';
import { ErrorState, Spinner } from '@/components/ui/states';
import { ConfirmDialog } from '@/components/ui/confirm';
import { useToast } from '@/components/ui/toast';
import { RegisterQr } from '@/components/register-qr';

/**
 * Home-page events — the event shown in the spllit.app Events section, inside
 * the shopfront, with its countdown and Register button.
 *
 * Lives at the top of Content → Events, above the events people create in the
 * app, so everything called an event is managed in one place.
 *
 * Add as many as you like. The site shows one at a time: whichever is on now,
 * otherwise the next to start. It counts down, switches to "happening now"
 * at the start time (registration closes then), and gives way to the next
 * event at the end time — all by the clock, with nothing to press. With none
 * left, the home page shows its general events section.
 * */

const LIVE_URL = 'https://spllit.app/#events';
const SUMMARY_MAX = 320;

interface FeaturedEvent {
  id: string;
  title: string;
  summary: string;
  poster: string;
  posterAlt: string;
  venue: string;
  area: string;
  mapUrl: string;
  startsAt: string;
  endsAt: string;
  registerUrl: string;
  /** auto: closes at the start. open: until the end. closed: closed now. */
  registration: Registration;
  hidden: boolean;
}

type Registration = 'auto' | 'open' | 'closed';

const REGISTRATION: { value: Registration; label: string; hint: string }[] = [
  { value: 'auto', label: 'Auto', hint: 'Open until the event starts, then closed.' },
  { value: 'open', label: 'Open', hint: 'Open until the event ends — walk-ins welcome.' },
  { value: 'closed', label: 'Closed', hint: 'Closed now, e.g. full. The button says so.' },
];

interface Content {
  events: FeaturedEvent[];
}

const BLANK: Content = { events: [] };

/** Every time here is IST, entered and shown, whatever this browser's zone is. */
const IST_OFFSET = '+05:30';

/** ISO with any offset → the "YYYY-MM-DDTHH:mm" a datetime-local input wants, in IST. */
function toIstInput(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/** The input's value, read as IST, stored with its offset. */
function fromIstInput(value: string): string {
  return value ? `${value}:00${IST_OFFSET}` : '';
}

function istLabel(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return 'No time set';
  return `${new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms))} IST`;
}

function newId(): string {
  return `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

type Phase = 'hidden' | 'ended' | 'live' | 'upcoming' | 'incomplete';

function phaseOf(event: FeaturedEvent, now: number): Phase {
  if (event.hidden) return 'hidden';
  const start = Date.parse(event.startsAt);
  const end = Date.parse(event.endsAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return 'incomplete';
  if (end <= now) return 'ended';
  if (start <= now) return 'live';
  return 'upcoming';
}

const PHASE_BADGE: Record<Phase, { label: string; className: string }> = {
  upcoming: { label: 'Upcoming', className: 'bg-brand-muted text-brand' },
  live: { label: 'Live now', className: 'bg-brand text-brand-fg' },
  ended: {
    label: 'Ended · shown as Closed',
    className: 'bg-surface-sunken text-ink-subtle ring-1 ring-line',
  },
  hidden: { label: 'Hidden', className: 'bg-warning-muted text-warning' },
  incomplete: { label: 'Needs times', className: 'bg-danger-muted text-danger' },
};

/** What the server would refuse, said here first, with the event to open. */
function findProblem(content: Content): { id: string; message: string } | null {
  for (const e of content.events) {
    const name = e.title.trim() || 'An event';
    if (!e.title.trim()) return { id: e.id, message: 'Every event needs a title.' };
    if (!e.summary.trim()) return { id: e.id, message: `${name} needs a description.` };
    if (e.summary.length > SUMMARY_MAX)
      return { id: e.id, message: `${name}'s description is too long.` };
    if (!e.venue.trim()) return { id: e.id, message: `${name} needs a venue.` };
    if (!e.startsAt || !e.endsAt) return { id: e.id, message: `${name} needs a start and end.` };
    if (Date.parse(e.endsAt) <= Date.parse(e.startsAt))
      return { id: e.id, message: `${name} has to end after it starts.` };
    if (!/^https:\/\//i.test(e.registerUrl.trim()))
      return { id: e.id, message: `${name} needs a Google Form link starting with https://` };
    for (const [label, value] of [
      ['poster', e.poster],
      ['map', e.mapUrl],
    ] as const) {
      if (value.trim() && !/^https:\/\//i.test(value.trim()))
        return { id: e.id, message: `${name}'s ${label} link must start with https://` };
    }
  }
  return null;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink-muted">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-ink-subtle">{hint}</span> : null}
    </label>
  );
}

function PosterPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const result = await apiUpload<{ url: string }>('/featured-events/image', file);
      onChange(result.url);
      toast.success('Poster uploaded. Publish to put it on the site.');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not upload that poster.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex items-start gap-4">
      <div className="flex aspect-[2/3] w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-sunken">
        {value ? (
          // Staff-only thumbnail of an uploaded URL.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className="px-2 text-center text-[11px] text-ink-subtle">No poster</span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif"
          className="hidden"
          onChange={(e) => void pick(e.target.files?.[0])}
        />
        <Button size="sm" disabled={disabled || busy} onClick={() => inputRef.current?.click()}>
          {busy ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          )}
          {busy ? 'Uploading…' : value ? 'Replace poster' : 'Upload poster'}
        </Button>
        {value ? (
          <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onChange('')}>
            Remove poster
          </Button>
        ) : null}
        <span className="max-w-[260px] text-[11px] text-ink-subtle">
          Portrait, 2:3 (e.g. 1080×1620). Shown whole inside the shop window, never cropped. Without
          one, the title is set as the poster.
        </span>
      </div>
    </div>
  );
}

export function FeaturedEventsManager() {
  const { can } = useAuth();
  const toast = useToast();
  const canEdit = can('settings.edit');

  const loaded = useQuery({
    queryKey: ['featured-events'],
    queryFn: () => api<{ content: Content | null }>('/featured-events'),
  });

  const [draft, setDraft] = useState<Content | null>(null);
  const [dirty, setDirty] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<FeaturedEvent | null>(null);
  // Read once per render for the status badges; a stale minute is harmless.
  const [now] = useState(() => Date.now());

  // Events saved before registration control existed read as 'auto'.
  const stored = useMemo<Content | null>(() => {
    const raw = loaded.data?.content;
    if (!raw) return null;
    return { events: raw.events.map((e) => ({ ...e, registration: e.registration ?? 'auto' })) };
  }, [loaded.data]);
  const content = draft ?? stored ?? (loaded.isSuccess ? BLANK : null);

  const save = useMutation({
    mutationFn: (body: Content) => api('/featured-events', { method: 'PUT', body }),
    onSuccess: () => {
      setDirty(false);
      toast.success('Published. The home page updates within a minute.');
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Could not publish the events.'),
  });

  const update = useCallback(
    (id: string, patch: Partial<FeaturedEvent>) => {
      if (!content) return;
      setDraft({ events: content.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
      setDirty(true);
    },
    [content],
  );

  const add = useCallback(() => {
    if (!content) return;
    const event: FeaturedEvent = {
      id: newId(),
      title: '',
      summary: '',
      poster: '',
      posterAlt: '',
      venue: '',
      area: '',
      mapUrl: '',
      startsAt: '',
      endsAt: '',
      registerUrl: '',
      registration: 'auto',
      hidden: false,
    };
    setDraft({ events: [event, ...content.events] });
    setOpenId(event.id);
    setDirty(true);
  }, [content]);

  const remove = useCallback(
    (id: string) => {
      if (!content) return;
      setDraft({ events: content.events.filter((e) => e.id !== id) });
      setOpenId(null);
      setRemoving(null);
      setDirty(true);
    },
    [content],
  );

  const problem = content ? findProblem(content) : null;

  const publish = useCallback(() => {
    if (!content) return;
    if (problem) {
      toast.error(problem.message);
      setOpenId(problem.id);
      return;
    }
    save.mutate(content);
  }, [content, problem, save, toast]);

  if (loaded.isPending) return <Spinner label="Loading featured events" />;
  if (loaded.isError) {
    // Without settings.view this block simply is not there; the app's events
    // list below it still is.
    if (loaded.error instanceof ApiError && loaded.error.isForbidden) return null;
    return (
      <ErrorState
        title="Could not load featured events"
        description={loaded.error.message}
        action={<Button onClick={() => void loaded.refetch()}>Try again</Button>}
      />
    );
  }
  if (!content) return null;

  // Soonest first, so the list reads in the order the site will show them.
  const ordered = [...content.events].sort(
    (a, b) => (Date.parse(a.startsAt) || Infinity) - (Date.parse(b.startsAt) || Infinity),
  );
  // What the site shows: the one on now, else the next, else the last to
  // finish within 30 days (shown with a Closed ribbon).
  const onSite =
    ordered.find((e) => phaseOf(e, now) === 'live') ??
    ordered.find((e) => phaseOf(e, now) === 'upcoming') ??
    [...ordered]
      .filter((e) => phaseOf(e, now) === 'ended' && now - Date.parse(e.endsAt) < 30 * 86_400_000)
      .sort((a, b) => Date.parse(b.endsAt) - Date.parse(a.endsAt))[0];

  return (
    <div className="space-y-3">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">On the spllit.app home page</h2>
            <p className="mt-0.5 text-xs text-ink-subtle">
              {onSite
                ? `Showing now: ${onSite.title || 'untitled'}.`
                : 'Nothing featured — the home page shows its general events section.'}{' '}
              Times are IST; the site moves from countdown to live to the next event by itself.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={LIVE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 items-center gap-1.5 rounded-[6px] px-2.5 text-xs font-medium text-ink-muted hover:text-ink"
            >
              View on site
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
            <Button size="sm" onClick={add} disabled={!canEdit}>
              <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Add event
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={publish}
              disabled={!canEdit || save.isPending || !dirty}
            >
              {save.isPending ? 'Publishing…' : dirty ? 'Publish' : 'Published'}
            </Button>
          </div>
        </div>

        {dirty ? (
          <p className="mt-3 text-xs font-medium text-warning">
            Unpublished changes — the site still shows the last published events.
          </p>
        ) : null}
        {!canEdit ? (
          <p className="mt-3 text-xs text-ink-subtle">
            Read only — editing needs the <code className="font-mono">settings.edit</code>{' '}
            permission.
          </p>
        ) : null}

        {ordered.length === 0 ? (
          <p className="mt-4 rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-ink-subtle">
            No events yet. Add one to feature it on the home page.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-md border border-line">
            {ordered.map((event) => {
              const open = openId === event.id;
              const phase = phaseOf(event, now);
              const badge = PHASE_BADGE[phase];
              return (
                <li key={event.id} className={cn(phase === 'ended' && !open && 'opacity-60')}>
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : event.id)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-raised"
                  >
                    <ChevronRight
                      className={cn(
                        'h-4 w-4 shrink-0 text-ink-subtle transition-transform duration-snap',
                        open && 'rotate-90',
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {event.title || 'Untitled event'}
                      </span>
                      <span className="block truncate text-xs text-ink-subtle">
                        {istLabel(event.startsAt)}
                        {event.venue ? ` · ${event.venue}` : ''}
                      </span>
                    </span>
                    {event.registration === 'closed' && phase !== 'ended' ? (
                      <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-ink-muted ring-1 ring-line">
                        Registration closed
                      </span>
                    ) : null}
                    {onSite?.id === event.id ? (
                      <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-medium text-canvas">
                        On the site
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-medium',
                        badge.className,
                      )}
                    >
                      {badge.label}
                    </span>
                  </button>

                  {open ? (
                    <div className="space-y-5 border-t border-line px-4 py-5 sm:px-6">
                      <PosterPicker
                        value={event.poster}
                        disabled={!canEdit}
                        onChange={(poster) => update(event.id, { poster })}
                      />

                      <Field label="Title">
                        <Input
                          value={event.title}
                          maxLength={90}
                          disabled={!canEdit}
                          placeholder="Spllit Campus Meetup"
                          onChange={(e) => update(event.id, { title: e.target.value })}
                        />
                      </Field>

                      <Field
                        label="What it is"
                        hint={`${event.summary.length}/${SUMMARY_MAX} · three or four lines on the page`}
                      >
                        <textarea
                          value={event.summary}
                          rows={4}
                          maxLength={SUMMARY_MAX}
                          disabled={!canEdit}
                          placeholder="Who it is for, what happens, why come."
                          onChange={(e) => update(event.id, { summary: e.target.value })}
                          className="mt-1 w-full rounded-md border border-line bg-surface-sunken px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
                        />
                      </Field>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Venue">
                          <Input
                            value={event.venue}
                            maxLength={80}
                            disabled={!canEdit}
                            placeholder="Anna University"
                            onChange={(e) => update(event.id, { venue: e.target.value })}
                          />
                        </Field>
                        <Field label="Area" hint="The line under the venue.">
                          <Input
                            value={event.area}
                            maxLength={80}
                            disabled={!canEdit}
                            placeholder="Guindy, Chennai"
                            onChange={(e) => update(event.id, { area: e.target.value })}
                          />
                        </Field>
                      </div>

                      <Field
                        label="Google Maps link (optional)"
                        hint="Paste the Share link from Google Maps. Left blank, the map button searches for the venue and area."
                      >
                        <Input
                          type="url"
                          inputMode="url"
                          value={event.mapUrl}
                          disabled={!canEdit}
                          placeholder="https://maps.app.goo.gl/…"
                          onChange={(e) => update(event.id, { mapUrl: e.target.value })}
                        />
                      </Field>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Starts (IST)" hint="The countdown runs to here.">
                          <Input
                            type="datetime-local"
                            value={toIstInput(event.startsAt)}
                            disabled={!canEdit}
                            onChange={(e) =>
                              update(event.id, { startsAt: fromIstInput(e.target.value) })
                            }
                          />
                        </Field>
                        <Field label="Ends (IST)" hint="After this the next event takes its place.">
                          <Input
                            type="datetime-local"
                            value={toIstInput(event.endsAt)}
                            disabled={!canEdit}
                            onChange={(e) =>
                              update(event.id, { endsAt: fromIstInput(e.target.value) })
                            }
                          />
                        </Field>
                      </div>

                      {/* The link, and beside it the QR the site will show for it —
                          generated as it is typed, ready to download for print. */}
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <div className="min-w-0 flex-1">
                          <Field
                            label="Registration — Google Form link"
                            hint="The Register button and the QR on the site both open this. The QR updates as you type."
                          >
                            <Input
                              type="url"
                              inputMode="url"
                              value={event.registerUrl}
                              disabled={!canEdit}
                              placeholder="https://forms.gle/…"
                              onChange={(e) => update(event.id, { registerUrl: e.target.value })}
                            />
                          </Field>
                        </div>
                        <RegisterQr url={event.registerUrl} title={event.title} />
                      </div>

                      <div>
                        <span className="text-xs font-medium text-ink-muted">Registration</span>
                        <div className="mt-1 inline-flex rounded-md border border-line bg-surface-sunken p-0.5">
                          {REGISTRATION.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              disabled={!canEdit}
                              aria-pressed={event.registration === option.value}
                              onClick={() => update(event.id, { registration: option.value })}
                              className={cn(
                                'rounded-[5px] px-3 py-1.5 text-xs font-medium transition-colors duration-snap',
                                event.registration === option.value
                                  ? 'bg-surface-raised text-ink shadow-sm ring-1 ring-line'
                                  : 'text-ink-muted hover:text-ink',
                              )}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                        <span className="mt-1 block text-[11px] text-ink-subtle">
                          {REGISTRATION.find((o) => o.value === event.registration)?.hint}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                        <label className="inline-flex items-center gap-2 text-xs text-ink-muted">
                          <input
                            type="checkbox"
                            checked={event.hidden}
                            disabled={!canEdit}
                            onChange={(e) => update(event.id, { hidden: e.target.checked })}
                          />
                          Hide from the site (keep here)
                        </label>
                        <div className="flex items-center gap-2">
                          {event.registerUrl ? (
                            <a
                              href={event.registerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-7 items-center gap-1.5 rounded-[6px] border border-line px-2.5 text-xs font-medium text-ink hover:border-line-strong"
                            >
                              Test form
                              <ExternalLink className="h-3 w-3" aria-hidden />
                            </a>
                          ) : null}
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={!canEdit}
                            onClick={() => setRemoving(event)}
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {removing ? (
        <ConfirmDialog
          title={`Remove ${removing.title || 'this event'}?`}
          description="It comes off the home page once you publish. To keep it but not show it, tick Hide instead."
          confirmLabel="Remove"
          destructive
          requireReason={false}
          onConfirm={() => remove(removing.id)}
          onCancel={() => setRemoving(null)}
        />
      ) : null}
    </div>
  );
}
