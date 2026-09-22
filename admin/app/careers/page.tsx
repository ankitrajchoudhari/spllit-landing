'use client';

import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ExternalLink, Plus, Trash2 } from 'lucide-react';

import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button, Card, Input, PageHeader, SectionHeader } from '@/components/ui/primitives';
import { ErrorState, PermissionState, Spinner } from '@/components/ui/states';
import { ConfirmDialog } from '@/components/ui/confirm';
import { useToast } from '@/components/ui/toast';

/**
 * Careers page editor.
 *
 * Everything on spllit.app/careers is written from here — the copy at the top,
 * the three "why join now" blocks, and the roles. It saves one JSON document to
 * the `careers.content` platform setting; there is no careers table, because a
 * handful of roles edited a few times a year does not justify a production
 * migration.
 *
 * Two things worth knowing while editing:
 *
 *  - A role closes on its own date. You do not have to come back and delete it,
 *    and you should not: a closed role stays on the page marked closed, so an
 *    applicant can see where their application went.
 *  - "Apply link" is where the Google Form goes, and a published open role has
 *    to have one. The public page gives an open role exactly one control —
 *    Apply — so a missing link would be a button that goes nowhere. To announce
 *    a role before its form exists, leave it as a draft or set it to closed.
 */

const LOCATIONS = ['Chennai', 'Jaipur', 'Remote (India)', 'Hybrid'] as const;
const TYPES = ['Full-time', 'Part-time', 'Internship', 'Contract'] as const;

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

  const content = draft ?? loaded.data?.content ?? (loaded.isSuccess ? BLANK : null);

  const save = useMutation({
    mutationFn: (body: Content) => api('/careers', { method: 'PUT', body }),
    onSuccess: () => {
      setDirty(false);
      toast.success('Careers page saved. The site picks it up within about half a minute.');
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Could not save the careers page.'),
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
    setDirty(true);
    setRemoving(null);
  }, [content]);

  /**
   * The public page gives an open role exactly one control: Apply. With no link
   * behind it the button points nowhere, so the server refuses to save this
   * combination — surfaced here first, because finding out at save time is a
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

  const submit = useCallback(() => {
    if (!content) return;
    if (duplicateIds.length > 0) {
      toast.error(`Two roles share the id "${duplicateIds[0]}" — ids are public links.`);
      return;
    }
    if (missingLink.length > 0) {
      const first = missingLink[0];
      toast.error(
        `"${first?.role.title || first?.role.id}" is open and published but has no apply link. Add the form URL, or set it to draft or closed.`,
      );
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

  const openCount = content.roles.filter((r) => !r.draft).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Careers"
        description={`What spllit.app/careers shows. ${content.roles.length} ${content.roles.length === 1 ? 'role' : 'roles'}, ${openCount} published.`}
        actions={
          <div className="flex items-center gap-2">
            <a
              href="https://spllit.app/careers"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-ink-muted hover:text-ink"
            >
              View page
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Button variant="primary" onClick={submit} disabled={!canEdit || save.isPending || !dirty}>
              {save.isPending ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
            </Button>
          </div>
        }
      />

      {!canEdit ? (
        <Card className="border-warning bg-warning-muted p-4 text-sm text-ink">
          You can read this page but not change it. Editing needs the{' '}
          <code className="font-mono text-xs">settings.edit</code> permission.
        </Card>
      ) : null}

      {/* Page copy */}
      <Card className="p-5">
        <SectionHeader title="Page copy" />
        <p className="mt-2 text-sm text-ink-muted">The top of the careers page.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Eyebrow">
            <Input value={content.eyebrow} onChange={(e) => update({ eyebrow: e.target.value })} />
          </Field>
          <Field label="Headline">
            <Input value={content.headline} onChange={(e) => update({ headline: e.target.value })} />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Standfirst" hint="The paragraph under the headline.">
            <Textarea value={content.standfirst} onChange={(v) => update({ standfirst: v })} />
          </Field>
        </div>
      </Card>

      {/* Why join */}
      <Card className="p-5">
        <SectionHeader title="What joining now means" />
        <p className="mt-2 text-sm text-ink-muted">Three blocks. Leave a title empty to drop that block.</p>
        <div className="mt-4 space-y-4">
          {content.pitch.map((item, index) => (
            <div key={index} className="grid gap-3 sm:grid-cols-[1fr_2fr]">
              <Field label={`Block ${index + 1} title`}>
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
      </Card>

      {/* Roles */}
      <Card className="p-5">
        <SectionHeader
          title="Open roles"
          aside={
            canEdit ? (
              <span className="flex items-center gap-2">
                {closedCount > 0 ? (
                  <Button variant="danger" onClick={() => setRemoving('closed')}>
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Remove {closedCount} closed
                  </Button>
                ) : null}
                <Button
                  onClick={() =>
                    update({
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
                    })
                  }
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add role
                </Button>
              </span>
            ) : null
          }
        />
        <p className="mt-2 text-sm text-ink-muted">
          Closing a role keeps it listed and marked closed. Removing takes it off
          the site for good — the page updates within about half a minute.
        </p>

        {content.roles.length === 0 ? (
          <p className="mt-4 rounded-md border border-dashed border-line bg-surface-sunken p-6 text-center text-sm text-ink-muted">
            No roles yet. The public page shows its empty state until you add one.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {content.roles.map((role, index) => {
              const dupe = duplicateIds.includes(role.id);
              return (
                <li
                  key={index}
                  className={cn(
                    'rounded-lg border bg-surface-sunken p-4',
                    dupe
                      ? 'border-danger'
                      : !role.draft && (role.status ?? 'open') === 'open' && !role.applyUrl.trim()
                        ? 'border-warning'
                        : 'border-line',
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                      Role {index + 1}
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px]',
                          (role.status ?? 'open') === 'closed'
                            ? 'bg-danger-muted text-danger'
                            : 'bg-brand-muted text-brand',
                        )}
                      >
                        {(role.status ?? 'open') === 'closed' ? 'Closed' : 'Open'}
                      </span>
                      {role.draft ? <span className="text-ink-subtle">· draft, hidden from the site</span> : null}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button size="sm" onClick={() => moveRole(index, -1)} disabled={index === 0}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => moveRole(index, 1)}
                        disabled={index === content.roles.length - 1}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={!canEdit}
                        title="Remove from the site"
                        onClick={() => setRemoving(index)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Title">
                      <Input
                        value={role.title}
                        placeholder="Founding Frontend Engineer"
                        onChange={(e) => {
                          const title = e.target.value;
                          // Keep the id tracking the title until somebody edits
                          // the id by hand — after that it is a public link and
                          // must not move under an applicant's feet.
                          const autoId = !role.id || role.id.startsWith('new-role-') || role.id === slugify(role.title);
                          updateRole(index, autoId ? { title, id: slugify(title) || role.id } : { title });
                        }}
                      />
                    </Field>
                    <Field label="Link id" hint="Used in the page link: /careers#this-id">
                      <Input
                        value={role.id}
                        onChange={(e) => updateRole(index, { id: slugify(e.target.value) })}
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
                    <Field
                      label="Closes on"
                      hint="Leave empty to stay open. After this date the role shows as Closed."
                    >
                      <Input
                        type="date"
                        value={toDateInput(role.closesAt)}
                        onChange={(e) =>
                          updateRole(index, { closesAt: fromDateInput(e.target.value) })
                        }
                      />
                    </Field>
                    <Field
                      label="Status"
                      hint="Closing by hand wins over the date — use it the moment a role is filled."
                    >
                      {/* Two buttons rather than a dropdown: there are exactly
                          two states, they are the thing an editor comes to this
                          page to change, and they carry the same green and red
                          the public page uses. */}
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
                                active && value === 'open' &&
                                  'border-brand bg-brand-muted text-brand',
                                active && value === 'closed' &&
                                  'border-danger bg-danger-muted text-danger',
                                !active && 'border-line bg-surface-sunken text-ink-muted hover:text-ink',
                              )}
                            >
                              {value}
                            </button>
                          );
                        })}
                      </div>
                    </Field>
                  </div>

                  <div className="mt-3">
                    <Field label="Apply link" hint="Paste the Google Form URL. If you leave it empty the Apply button still works — it opens an email to support@spllit.app with the role in the subject.">
                      <Input
                        value={role.applyUrl}
                        placeholder="https://forms.gle/…"
                        onChange={(e) => updateRole(index, { applyUrl: e.target.value })}
                      />
                    </Field>
                  </div>

                  <div className="mt-3">
                    <Field label="Summary">
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
                        rows={4}
                        value={role.responsibilities.join('\n')}
                        onChange={(v) =>
                          updateRole(index, {
                            responsibilities: v.split('\n').map((l) => l.trim()).filter(Boolean),
                          })
                        }
                      />
                    </Field>
                  </div>

                  <label className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
                    <input
                      type="checkbox"
                      checked={!role.draft}
                      onChange={(e) => updateRole(index, { draft: !e.target.checked })}
                      className="h-4 w-4 rounded border-line"
                    />
                    Published on the site
                  </label>

                  {dupe ? (
                    <p className="mt-2 text-xs text-danger">
                      Another role uses this link id. Both would share the same page anchor.
                    </p>
                  ) : null}
                  {!role.draft && (role.status ?? 'open') === 'open' && !role.applyUrl.trim() ? (
                    <p className="mt-2 text-xs text-warning">
                      Open and published, but no apply link. The site shows one Apply
                      button per open role, so add the form URL — or set this role to
                      draft or closed until you have one.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {removing !== null ? (
        <ConfirmDialog
          destructive
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

      {/* Empty state */}
      <Card className="p-5">
        <SectionHeader title="When nothing is open" />
        <p className="mt-2 text-sm text-ink-muted">Shown on the site once every role is closed or unpublished.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_2fr]">
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
      </Card>
    </div>
  );
}
