'use client';

import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ChevronRight, ExternalLink, Plus, Trash2 } from 'lucide-react';

import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button, Card, Input, PageHeader } from '@/components/ui/primitives';
import { ErrorState, PermissionState, Spinner } from '@/components/ui/states';
import { ConfirmDialog } from '@/components/ui/confirm';
import { useToast } from '@/components/ui/toast';

/**
 * Careers page editor.
 *
 * Everything on spllit.app/careers is written from here. It saves one JSON
 * document to the `careers.content` platform setting; there is no careers
 * table, because a handful of roles edited a few times a year does not justify
 * a production migration.
 *
 * Laid out as a list of roles rather than a wall of fields. The first version
 * showed every field of every role plus four blocks of page copy expanded at
 * once, so adding one role meant scrolling past everything already there.
 * Roles are now rows that open one at a time, and the page text and the email
 * setup — both touched rarely — sit behind disclosures.
 *
 * Two things worth knowing while editing:
 *
 *  - Closing a role and removing one are different. A closed role stays on the
 *    site marked closed, so an applicant can see where their application went.
 *    A removed one is gone.
 *  - A live, open role has to have a form link. The site gives such a role
 *    exactly one control — Apply — so without a link that button goes nowhere.
 *    To announce a role before its form exists, leave it hidden or closed.
 */

const LOCATIONS = ['Chennai', 'Jaipur', 'Remote (India)', 'Hybrid'] as const;
const TYPES = ['Full-time', 'Part-time', 'Internship', 'Contract'] as const;
const LIVE_URL = 'https://spllit.app/careers';

interface Role {
  id: string;
  title: string;
  team: string;
  location: (typeof LOCATIONS)[number];
  type: (typeof TYPES)[number];
  summary: string;
  responsibilities: string[];
  applyUrl: string;
  closesAt: string | null;
  status: 'open' | 'closed';
  draft: boolean;
}

interface Content {
  eyebrow: string;
  headline: string;
  standfirst: string;
  pitch: { title: string; body: string }[];
  roles: Role[];
  emptyState: { title: string; body: string };
}

const BLANK: Content = {
  eyebrow: 'Careers',
  headline: 'Build the thing before it exists.',
  standfirst: '',
  pitch: [
    { title: '', body: '' },
    { title: '', body: '' },
    { title: '', body: '' },
  ],
  roles: [],
  emptyState: { title: 'No open roles right now.', body: '' },
};

/** Lowercase, hyphenated, and stable enough to use as a public anchor. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** `<input type="date">` wants YYYY-MM-DD; the API stores a full ISO instant. */
function toDateInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function fromDateInput(value: string): string | null {
  if (!value) return null;
  // End of the chosen day, so "closes 30 Nov" means applications are open
  // through the 30th rather than shutting at midnight as it begins.
  const d = new Date(`${value}T23:59:59.000Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Only an http(s) URL can be opened in a tab; a half-typed one cannot. */
function isWebLink(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim());
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

function Textarea({
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'mt-1 w-full rounded-md border border-line bg-surface-sunken px-3 py-2 text-sm text-ink',
        'transition-colors duration-snap placeholder:text-ink-subtle',
        'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25',
      )}
    />
  );
}

function Picker<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={cn(
        'mt-1 h-9 w-full rounded-md border border-line bg-surface-sunken px-3 text-sm text-ink',
        'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25',
      )}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

/** Things edited once a quarter should not sit in front of things edited weekly. */
function Disclosure({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <ChevronRight
          className={cn(
            'h-4 w-4 shrink-0 text-ink-subtle transition-transform duration-snap',
            open && 'rotate-90',
          )}
          aria-hidden
        />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-ink">{title}</span>
          <span className="block text-xs text-ink-muted">{description}</span>
        </span>
      </button>
      {open ? <div className="border-t border-line p-5">{children}</div> : null}
    </Card>
  );
}

/** What this role is doing on the site right now, in one word. */
function StatusChip({ role }: { role: Role }) {
  if (role.draft) {
    return (
      <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-subtle ring-1 ring-line">
        Hidden
      </span>
    );
  }
  const closed = (role.status ?? 'open') === 'closed';
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        closed ? 'bg-danger-muted text-danger' : 'bg-brand-muted text-brand',
      )}
    >
      {closed ? 'Closed' : 'Live'}
    </span>
  );
}

export default function CareersPage() {
  const { can } = useAuth();
  const toast = useToast();
  const canEdit = can('settings.edit');

  /**
   * Loaded through react-query like every other console page, and edited from a
   * local draft. The draft is seeded from the query rather than kept in sync
   * with it: a refetch landing mid-edit and silently replacing what somebody
   * had typed would be worse than showing slightly stale data.
   */
  const loaded = useQuery({
    queryKey: ['careers'],
    queryFn: () => api<{ content: Content | null }>('/careers'),
  });

  const [draft, setDraft] = useState<Content | null>(null);
  const [dirty, setDirty] = useState(false);
  /** Index of a single role awaiting confirmation, or 'closed' for the bulk sweep. */
  const [removing, setRemoving] = useState<number | 'closed' | null>(null);
  /** Which role is expanded. One at a time, so the list stays readable as a list. */
  const [openRole, setOpenRole] = useState<number | null>(null);

  const content = draft ?? loaded.data?.content ?? (loaded.isSuccess ? BLANK : null);

  const save = useMutation({
    mutationFn: (body: Content) => api('/careers', { method: 'PUT', body }),
    onSuccess: () => {
      setDirty(false);
      toast.success('Published. The site picks it up within about half a minute.');
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Could not publish the changes.'),
  });

  const update = useCallback(
    (patch: Partial<Content>) => {
      if (!content) return;
      setDraft({ ...content, ...patch });
      setDirty(true);
    },
    [content],
  );

  const updateRole = useCallback(
    (index: number, patch: Partial<Role>) => {
      if (!content) return;
      setDraft({
        ...content,
        roles: content.roles.map((role, i) => (i === index ? { ...role, ...patch } : role)),
      });
      setDirty(true);
    },
    [content],
  );

  const moveRole = useCallback(
    (index: number, delta: number) => {
      if (!content) return;
      const next = [...content.roles];
      const target = index + delta;
      const a = next[index];
      const b = next[target];
      if (!a || !b) return;
      next[index] = b;
      next[target] = a;
      setDraft({ ...content, roles: next });
      // Follow the role that moved, rather than leaving a different one open.
      setOpenRole((cur) => (cur === index ? target : cur === target ? index : cur));
      setDirty(true);
    },
    [content],
  );

  /**
   * Removing takes a role off the site for good — it is not the same as closing
   * it. A closed role stays listed so an applicant can see their application
   * went somewhere; a removed one is gone. Both are wanted, which is why the
   * status toggle and this are separate controls.
   */
  const removeRole = useCallback(
    (index: number) => {
      if (!content) return;
      setDraft({ ...content, roles: content.roles.filter((_, i) => i !== index) });
      setOpenRole(null);
      setDirty(true);
      setRemoving(null);
    },
    [content],
  );

  const closedCount = useMemo(
    () => (content ? content.roles.filter((r) => (r.status ?? 'open') === 'closed').length : 0),
    [content],
  );

  const removeAllClosed = useCallback(() => {
    if (!content) return;
    setDraft({ ...content, roles: content.roles.filter((r) => (r.status ?? 'open') !== 'closed') });
    setOpenRole(null);
    setDirty(true);
    setRemoving(null);
  }, [content]);

  /**
   * The public page gives an open role exactly one control: Apply. With no link
   * behind it the button points nowhere, so the server refuses to save this
   * combination — surfaced here first, because finding out at publish time is a
   * worse way to learn it.
   */
  const missingLink = useMemo(
    () =>
      content
        ? content.roles
            .map((role, index) => ({ role, index }))
            .filter(
              ({ role }) =>
                !role.draft && (role.status ?? 'open') === 'open' && !role.applyUrl.trim(),
            )
        : [],
    [content],
  );

  const duplicateIds = useMemo(() => {
    if (!content) return [];
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const role of content.roles) {
      if (seen.has(role.id)) dupes.add(role.id);
      seen.add(role.id);
    }
    return [...dupes];
  }, [content]);

  const addRole = useCallback(() => {
    if (!content) return;
    setDraft({
      ...content,
      roles: [
        ...content.roles,
        {
          id: `new-role-${content.roles.length + 1}`,
          title: '',
          team: 'Engineering',
          location: 'Chennai',
          type: 'Full-time',
          summary: '',
          responsibilities: [],
          applyUrl: '',
          closesAt: null,
          status: 'open',
          draft: true,
        },
      ],
    });
    // Adding a role is always followed by filling it in, so open it.
    setOpenRole(content.roles.length);
    setDirty(true);
  }, [content]);

  const publish = useCallback(() => {
    if (!content) return;
    if (duplicateIds.length > 0) {
      toast.error(`Two roles share the id "${duplicateIds[0]}" — ids are public links.`);
      return;
    }
    if (missingLink.length > 0) {
      const first = missingLink[0];
      toast.error(
        `"${first?.role.title || first?.role.id}" is live but has no form link. Add it, or hide the role until you have one.`,
      );
      // Open the offending role, so the fix is one scroll away rather than a hunt.
      setOpenRole(first ? first.index : null);
      return;
    }
    save.mutate(content);
  }, [content, duplicateIds, missingLink, save, toast]);

  if (loaded.isPending) return <Spinner label="Loading the careers page" />;
  if (loaded.isError) {
    if (loaded.error instanceof ApiError && loaded.error.isForbidden) {
      return <PermissionState permission="settings.view" />;
    }
    return (
      <ErrorState
        title="Could not load the careers page"
        description={loaded.error.message}
        action={<Button onClick={() => void loaded.refetch()}>Try again</Button>}
      />
    );
  }
  if (!content) return null;

  const liveCount = content.roles.filter((r) => !r.draft && (r.status ?? 'open') === 'open').length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Careers"
        description={`${liveCount} live on the site · ${content.roles.length} in total`}
        actions={
          <div className="flex items-center gap-2">
            <a
              href={LIVE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-ink-muted hover:text-ink"
            >
              View live page
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
            <Button
              variant="primary"
              onClick={publish}
              disabled={!canEdit || save.isPending || !dirty}
            >
              {save.isPending ? 'Publishing…' : dirty ? 'Publish' : 'Published'}
            </Button>
          </div>
        }
      />

      {/* Nothing here reaches the site until Publish, so say so rather than
          letting an editor close the tab believing it is live. */}
      {dirty ? (
        <p className="text-xs font-medium text-warning">
          Unpublished changes — the site still shows the last published version.
        </p>
      ) : null}

      {!canEdit ? (
        <Card className="border-warning bg-warning-muted p-4 text-sm text-ink">
          You can read this page but not change it. Editing needs the{' '}
          <code className="font-mono text-xs">settings.edit</code> permission.
        </Card>
      ) : null}

      {/* Roles come first, and nothing is expanded above them: this is what the
          page is for. */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Roles</h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Click one to edit it. Closing keeps it listed and marked closed; removing takes it
              off the site for good.
            </p>
          </div>
          {canEdit ? (
            <div className="flex items-center gap-2">
              {closedCount > 0 ? (
                <Button variant="danger" onClick={() => setRemoving('closed')}>
                  <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
                  Remove {closedCount} closed
                </Button>
              ) : null}
              <Button variant="primary" onClick={addRole}>
                <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                Add role
              </Button>
            </div>
          ) : null}
        </div>

        {content.roles.length === 0 ? (
          <p className="mt-4 rounded-md border border-dashed border-line bg-surface-sunken p-6 text-center text-sm text-ink-muted">
            No roles yet. The site shows its &ldquo;nothing open&rdquo; state until you add one.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {content.roles.map((role, index) => {
              const expanded = openRole === index;
              const dupe = duplicateIds.includes(role.id);
              const needsLink =
                !role.draft && (role.status ?? 'open') === 'open' && !role.applyUrl.trim();

              return (
                <li
                  key={index}
                  className={cn(
                    'overflow-hidden rounded-lg border bg-surface-sunken',
                    dupe ? 'border-danger' : needsLink ? 'border-warning' : 'border-line',
                  )}
                >
                  {/* Collapsed row: enough to find a role, nothing to scroll
                      past on the way to the next one. */}
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => setOpenRole(expanded ? null : index)}
                      aria-expanded={expanded}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      <ChevronRight
                        className={cn(
                          'h-4 w-4 shrink-0 text-ink-subtle transition-transform duration-snap',
                          expanded && 'rotate-90',
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">
                          {role.title || <span className="text-ink-subtle">Untitled role</span>}
                        </span>
                        <span className="block truncate text-xs text-ink-muted">
                          {role.team} · {role.location} · {role.type}
                        </span>
                      </span>
                      <StatusChip role={role} />
                    </button>

                    <span className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        onClick={() => moveRole(index, -1)}
                        disabled={index === 0}
                        title="Move up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => moveRole(index, 1)}
                        disabled={index === content.roles.length - 1}
                        title="Move down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={!canEdit}
                        title="Remove from the site"
                        onClick={() => setRemoving(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </span>
                  </div>

                  {expanded ? (
                    <div className="border-t border-line bg-surface p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Title">
                          <Input
                            value={role.title}
                            placeholder="Founding Frontend Engineer"
                            onChange={(e) => {
                              const title = e.target.value;
                              // Keep the id tracking the title until somebody
                              // edits the id by hand. After that it is a public
                              // link, and must not move under anyone holding it.
                              const autoId =
                                !role.id ||
                                role.id.startsWith('new-role-') ||
                                role.id === slugify(role.title);
                              updateRole(
                                index,
                                autoId ? { title, id: slugify(title) || role.id } : { title },
                              );
                            }}
                          />
                        </Field>
                        <Field label="Team">
                          <Input
                            value={role.team}
                            placeholder="Engineering"
                            onChange={(e) => updateRole(index, { team: e.target.value })}
                          />
                        </Field>
                        <Field label="Location">
                          <Picker
                            value={role.location}
                            options={LOCATIONS}
                            onChange={(location) => updateRole(index, { location })}
                          />
                        </Field>
                        <Field label="Type">
                          <Picker
                            value={role.type}
                            options={TYPES}
                            onChange={(type) => updateRole(index, { type })}
                          />
                        </Field>
                      </div>

                      {/* The form link, with a way to open it. A URL you cannot
                          click is a URL you cannot check before publishing it. */}
                      <div className="mt-3">
                        <Field
                          label="Google Form link"
                          hint="Where Apply sends people. A live role needs one."
                        >
                          <div className="mt-1 flex gap-2">
                            <Input
                              type="url"
                              inputMode="url"
                              value={role.applyUrl}
                              placeholder="https://forms.gle/…"
                              onChange={(e) => updateRole(index, { applyUrl: e.target.value })}
                            />
                            {isWebLink(role.applyUrl) ? (
                              <a
                                href={role.applyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-line px-3 text-sm font-medium text-ink transition-colors duration-snap hover:border-line-strong"
                              >
                                Open
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                              </a>
                            ) : (
                              <span className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-line px-3 text-sm font-medium text-ink-subtle opacity-50">
                                Open
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                              </span>
                            )}
                          </div>
                        </Field>
                      </div>

                      <div className="mt-3">
                        <Field label="Summary" hint="One or two sentences, shown under the title.">
                          <Textarea
                            rows={2}
                            value={role.summary}
                            onChange={(v) => updateRole(index, { summary: v })}
                          />
                        </Field>
                      </div>

                      <div className="mt-3">
                        <Field label="Responsibilities" hint="One per line.">
                          <Textarea
                            rows={3}
                            value={role.responsibilities.join('\n')}
                            onChange={(v) =>
                              updateRole(index, {
                                responsibilities: v
                                  .split('\n')
                                  .map((l) => l.trim())
                                  .filter(Boolean),
                              })
                            }
                          />
                        </Field>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <Field
                          label="Closes on"
                          hint="Optional. After this date the site marks it closed on its own."
                        >
                          <Input
                            type="date"
                            value={toDateInput(role.closesAt)}
                            onChange={(e) =>
                              updateRole(index, { closesAt: fromDateInput(e.target.value) })
                            }
                          />
                        </Field>
                        <Field label="Status" hint="Closing by hand wins over the date.">
                          {/* Two buttons rather than a dropdown: there are
                              exactly two states, and they carry the same green
                              and red the public page uses. */}
                          <div className="mt-1 flex gap-2">
                            {(['open', 'closed'] as const).map((value) => {
                              const active = (role.status ?? 'open') === value;
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  disabled={!canEdit}
                                  onClick={() => updateRole(index, { status: value })}
                                  className={cn(
                                    'h-9 flex-1 rounded-md border text-sm font-medium capitalize transition-colors duration-snap',
                                    active &&
                                      value === 'open' &&
                                      'border-brand bg-brand-muted text-brand',
                                    active &&
                                      value === 'closed' &&
                                      'border-danger bg-danger-muted text-danger',
                                    !active &&
                                      'border-line bg-surface-sunken text-ink-muted hover:text-ink',
                                  )}
                                >
                                  {value}
                                </button>
                              );
                            })}
                          </div>
                        </Field>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                        <label className="flex items-center gap-2 text-sm text-ink-muted">
                          <input
                            type="checkbox"
                            checked={!role.draft}
                            disabled={!canEdit}
                            onChange={(e) => updateRole(index, { draft: !e.target.checked })}
                            className="h-4 w-4 rounded border-line"
                          />
                          Show on the site
                        </label>
                        <span className="flex items-center gap-2">
                          <span className="text-[11px] text-ink-subtle">Link id</span>
                          <Input
                            value={role.id}
                            title="Used in /careers#this-id, and as ROLE_ID in the form script"
                            onChange={(e) => updateRole(index, { id: slugify(e.target.value) })}
                            className="h-8 w-[200px] font-mono text-[11px]"
                          />
                        </span>
                      </div>

                      {dupe ? (
                        <p className="mt-2 text-xs text-danger">
                          Another role uses this link id. Both would share the same page anchor.
                        </p>
                      ) : null}
                      {needsLink ? (
                        <p className="mt-2 text-xs text-warning">
                          Shown on the site with no form link. Add one, or untick &ldquo;Show on the
                          site&rdquo; until you have it.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Written once and rarely changed, so it sits behind a disclosure
          instead of between an editor and the roles. */}
      <Disclosure
        title="Page text"
        description="The headline, the intro, and what shows when nothing is open."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Eyebrow">
            <Input value={content.eyebrow} onChange={(e) => update({ eyebrow: e.target.value })} />
          </Field>
          <Field label="Headline">
            <Input value={content.headline} onChange={(e) => update({ headline: e.target.value })} />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Intro paragraph" hint="The paragraph under the headline.">
            <Textarea value={content.standfirst} onChange={(v) => update({ standfirst: v })} />
          </Field>
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          What joining now means
        </p>
        <p className="mt-1 text-xs text-ink-muted">Three blocks. Leave a title empty to drop one.</p>
        <div className="mt-3 space-y-3">
          {content.pitch.map((item, index) => (
            <div key={index} className="grid gap-3 sm:grid-cols-[1fr_2fr]">
              <Field label={`Block ${index + 1}`}>
                <Input
                  value={item.title}
                  onChange={(e) => {
                    const pitch = [...content.pitch];
                    pitch[index] = { title: e.target.value, body: item.body };
                    update({ pitch });
                  }}
                />
              </Field>
              <Field label="Body">
                <Textarea
                  rows={2}
                  value={item.body}
                  onChange={(v) => {
                    const pitch = [...content.pitch];
                    pitch[index] = { title: item.title, body: v };
                    update({ pitch });
                  }}
                />
              </Field>
            </div>
          ))}
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          When nothing is open
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          Shown once every role is closed or hidden.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_2fr]">
          <Field label="Title">
            <Input
              value={content.emptyState.title}
              onChange={(e) =>
                update({ emptyState: { ...content.emptyState, title: e.target.value } })
              }
            />
          </Field>
          <Field label="Body">
            <Textarea
              rows={2}
              value={content.emptyState.body}
              onChange={(v) => update({ emptyState: { ...content.emptyState, body: v } })}
            />
          </Field>
        </div>
      </Disclosure>

      <Disclosure
        title="Confirmation emails"
        description="One-time setup per form, so applicants hear back from Spllit."
      >
        <p className="text-sm text-ink-muted">
          Google hosts the form, so submitting it tells Spllit nothing on its own. Paste the script
          below into the form once and applicants get a confirmation from us. Without it the
          application still arrives in the form responses — the applicant just hears nothing.
        </p>

        <ol className="mt-4 space-y-2 text-sm text-ink-muted">
          <li>
            1. Open the Google Form, then <strong className="text-ink">⋮ → Apps Script</strong>.
          </li>
          <li>
            2. Replace the contents with the script below, putting the Link id of the role in{' '}
            <code className="font-mono text-xs text-ink">ROLE_ID</code>.
          </li>
          <li>
            3. Run <strong className="text-ink">install()</strong> once and accept the permission
            prompt. That is what attaches it to form submissions.
          </li>
        </ol>

        <pre className="mt-4 overflow-x-auto rounded-md border border-line bg-surface-sunken p-4 text-[12px] leading-relaxed text-ink-muted">
{`const ENDPOINT = 'https://api.spllit.app/api/public/careers/application';
const SECRET   = '<CAREERS_WEBHOOK_SECRET from the backend env>';
const ROLE_ID  = 'founding-frontend-engineer';   // the Link id of the role

// Which questions hold the email and the name. Match the wording of your
// form; the email can also be the built-in email collection of the form.
const EMAIL_QUESTION = 'Email';
const NAME_QUESTION  = 'Full name';

function onSubmit(e) {
  const answers = {};
  e.response.getItemResponses().forEach(r => {
    answers[r.getItem().getTitle().trim()] = r.getResponse();
  });

  const email = answers[EMAIL_QUESTION] || e.response.getRespondentEmail();
  if (!email) return;                       // nothing to send to

  UrlFetchApp.fetch(ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-spllit-careers-secret': SECRET },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      email: email,
      name: answers[NAME_QUESTION] || '',
      roleId: ROLE_ID,
      submissionId: e.response.getId()      // stops a retry sending twice
    })
  });
}

// Run this once, by hand, to attach onSubmit to the form.
function install() {
  ScriptApp.newTrigger('onSubmit')
    .forForm(FormApp.getActiveForm())
    .onFormSubmit()
    .create();
}`}
        </pre>

        <dl className="mt-4 grid gap-2 text-[12px] text-ink-subtle sm:grid-cols-[130px_1fr]">
          <dt className="font-medium text-ink-muted">Sent from</dt>
          <dd className="font-mono">notifications@mail.spllit.app</dd>
          <dt className="font-medium text-ink-muted">Replies go to</dt>
          <dd className="font-mono">career@spllit.app</dd>
          <dt className="font-medium text-ink-muted">Delivery webhook</dt>
          <dd className="font-mono">https://api.spllit.app/webhooks/resend</dd>
        </dl>

        <p className="mt-3 text-[12px] text-ink-subtle">
          The endpoint refuses anything without the secret, and only sends for a Link id that
          exists and is shown on the site — so it cannot be used to mail arbitrary people. It
          answers 503 until <code className="font-mono">CAREERS_WEBHOOK_SECRET</code> is set on
          the backend.
        </p>
      </Disclosure>

      {removing !== null ? (
        <ConfirmDialog
          destructive
          // Removing edits the local draft; nothing is recorded until Publish,
          // so a mandatory reason field here would collect text that goes nowhere.
          requireReason={false}
          title={removing === 'closed' ? `Remove ${closedCount} closed roles?` : 'Remove this role?'}
          confirmLabel="Remove"
          description={
            removing === 'closed'
              ? 'They come off the careers page for good. Anyone holding a link to one of them will land on the page with no role. Closing a role instead keeps it listed and marked closed.'
              : 'It comes off the careers page for good, and any link to it stops resolving. If you only want to stop applications, set the role to Closed instead — it stays listed so applicants can see what happened.'
          }
          onCancel={() => setRemoving(null)}
          onConfirm={() => (removing === 'closed' ? removeAllClosed() : removeRole(removing))}
        />
      ) : null}
    </div>
  );
}
