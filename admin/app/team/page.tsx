'use client';

import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  ExternalLink,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';

import { api, apiUpload, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button, Card, Input, PageHeader } from '@/components/ui/primitives';
import { ErrorState, PermissionState, Spinner } from '@/components/ui/states';
import { ConfirmDialog } from '@/components/ui/confirm';
import { useToast } from '@/components/ui/toast';

/**
 * Team editor — the people on spllit.app/about.
 *
 * Same shape as the blog and careers editors: collapsed rows that open one at a
 * time, and one Publish that sends the whole list. Nobody is deleted for
 * leaving — set them to Exited and the site moves them to Alumni, faded.
 * Remove is for mistakes.
 */

const SITE = 'https://spllit.app';
const LIVE_URL = `${SITE}/about`;

type Group = 'founder' | 'core' | 'intern';
type Status = 'active' | 'exited';

interface Links {
  linkedin: string;
  instagram: string;
  x: string;
  github: string;
  website: string;
}

interface Member {
  id: string;
  name: string;
  role: string;
  group: Group;
  status: Status;
  bio: string;
  photo: string;
  links: Links;
  hidden: boolean;
}

interface Content {
  members: Member[];
}

const NO_LINKS: Links = { linkedin: '', instagram: '', x: '', github: '', website: '' };

const GROUPS: { value: Group; label: string }[] = [
  { value: 'founder', label: 'Founder' },
  { value: 'core', label: 'Core team' },
  { value: 'intern', label: 'Intern' },
];

const LINK_FIELDS: { key: keyof Links; label: string; placeholder: string }[] = [
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://www.linkedin.com/in/…' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://www.instagram.com/…' },
  { key: 'x', label: 'X (Twitter)', placeholder: 'https://x.com/…' },
  { key: 'github', label: 'GitHub', placeholder: 'https://github.com/…' },
  { key: 'website', label: 'Website', placeholder: 'https://…' },
];

const BIO_MAX = 280;

/**
 * What the site shows before the console has ever been saved. Opening the
 * editor for the first time starts from this, so the people already on the
 * page do not have to be typed in again.
 */
const CURRENT_SITE: Content = {
  members: [
    {
      id: 'ankit-raj-choudhari',
      name: 'Ankit Raj Choudhari',
      role: 'Founder',
      group: 'founder',
      status: 'active',
      bio: 'Started Spllit after watching classmates leave campus for the same places in separate autos. Builds the product and runs the company.',
      photo: '/team/ankit-raj-choudhari.jpg',
      links: NO_LINKS,
      hidden: false,
    },
    {
      id: 'sanjh-verma',
      name: 'Sanjh Verma',
      role: 'Core team',
      group: 'core',
      status: 'active',
      bio: '',
      photo: '',
      links: { ...NO_LINKS, linkedin: 'https://www.linkedin.com/in/sanjh-verma01/' },
      hidden: false,
    },
    {
      id: 'saurav-kumar',
      name: 'Saurav Kumar',
      role: 'Core team',
      group: 'core',
      status: 'active',
      bio: '',
      photo: '',
      links: { ...NO_LINKS, linkedin: 'https://www.linkedin.com/in/saurav-kumar-a22169352/' },
      hidden: false,
    },
    {
      id: 'mayank-jain',
      name: 'Mayank Jain',
      role: 'Intern',
      group: 'intern',
      status: 'exited',
      bio: '',
      photo: '',
      links: { ...NO_LINKS, linkedin: 'https://www.linkedin.com/in/mayank-jain-2511mj/' },
      hidden: false,
    },
  ],
};

function newId(): string {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** A photo stored as a site path (/team/…) only resolves on spllit.app. */
function photoSrc(photo: string): string {
  return photo.startsWith('/') ? `${SITE}${photo}` : photo;
}

function isHttps(value: string): boolean {
  return value === '' || /^https:\/\//i.test(value.trim());
}

/** What the server would refuse, said here first, with the row to open. */
function findProblem(content: Content): { id: string; message: string } | null {
  for (const m of content.members) {
    if (!m.name.trim()) return { id: m.id, message: 'Every person needs a name.' };
    if (!m.role.trim()) return { id: m.id, message: `${m.name} needs a role.` };
    if (m.bio.length > BIO_MAX)
      return { id: m.id, message: `${m.name}'s description is too long.` };
    const bad = LINK_FIELDS.find((f) => !isHttps(m.links[f.key]));
    if (bad) return { id: m.id, message: `${m.name}'s ${bad.label} link must start with https://` };
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

/** A row of mutually exclusive choices. */
function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-1 inline-flex rounded-md border border-line bg-surface-sunken p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-[5px] px-3 py-1.5 text-xs font-medium transition-colors duration-snap',
            value === option.value
              ? 'bg-surface-raised text-ink shadow-sm ring-1 ring-line'
              : 'text-ink-muted hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Avatar({ member, size = 'sm' }: { member: Member; size?: 'sm' | 'lg' }) {
  const box = size === 'lg' ? 'h-24 w-24' : 'h-9 w-9';
  if (member.photo) {
    return (
      // Staff-only thumbnail of an arbitrary uploaded URL; next/image would
      // need every host allowlisted here as well as on the site.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoSrc(member.photo)}
        alt=""
        className={cn(
          box,
          'shrink-0 rounded-full object-cover ring-1 ring-line',
          member.status === 'exited' && 'grayscale',
        )}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        box,
        'flex shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
        member.status === 'exited' ? 'bg-ink-subtle' : 'bg-brand',
      )}
    >
      {member.name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

/** Upload on pick, separately from Publish, like the blog's image picker. */
function PhotoPicker({
  member,
  onChange,
  disabled,
}: {
  member: Member;
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
      const result = await apiUpload<{ url: string }>('/team/image', file);
      onChange(result.url);
      toast.success('Photo uploaded. Publish to put it on the site.');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not upload that photo.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar member={member} size="lg" />
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
          {busy ? 'Uploading…' : member.photo ? 'Replace photo' : 'Upload photo'}
        </Button>
        {member.photo ? (
          <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onChange('')}>
            Remove photo
          </Button>
        ) : (
          <span className="text-[11px] text-ink-subtle">
            Portrait, face near the top. Without one the card shows green bands.
          </span>
        )}
      </div>
    </div>
  );
}

function GroupBadge({ member }: { member: Member }) {
  const label = GROUPS.find((g) => g.value === member.group)?.label ?? 'Core team';
  return (
    <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-ink-muted ring-1 ring-line">
      {label}
    </span>
  );
}

export default function TeamAdminPage() {
  const { can } = useAuth();
  const toast = useToast();
  const canEdit = can('settings.edit');

  const loaded = useQuery({
    queryKey: ['team'],
    queryFn: () => api<{ content: Content | null }>('/team'),
  });

  const [draft, setDraft] = useState<Content | null>(null);
  const [dirty, setDirty] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);

  const neverSaved = loaded.isSuccess && !loaded.data?.content;
  const content = draft ?? loaded.data?.content ?? (loaded.isSuccess ? CURRENT_SITE : null);

  const save = useMutation({
    mutationFn: (body: Content) => api('/team', { method: 'PUT', body }),
    onSuccess: () => {
      setDirty(false);
      toast.success('Published. spllit.app/about updates within a minute.');
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Could not publish the team.'),
  });

  const update = useCallback(
    (id: string, patch: Partial<Member>) => {
      if (!content) return;
      setDraft({
        members: content.members.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      });
      setDirty(true);
    },
    [content],
  );

  const move = useCallback(
    (index: number, delta: number) => {
      if (!content) return;
      const next = [...content.members];
      const a = next[index];
      const b = next[index + delta];
      if (!a || !b) return;
      next[index] = b;
      next[index + delta] = a;
      setDraft({ members: next });
      setDirty(true);
    },
    [content],
  );

  const add = useCallback(() => {
    if (!content) return;
    const member: Member = {
      id: newId(),
      name: '',
      role: '',
      group: 'core',
      status: 'active',
      bio: '',
      photo: '',
      links: NO_LINKS,
      hidden: false,
    };
    setDraft({ members: [...content.members, member] });
    setOpenId(member.id);
    setDirty(true);
  }, [content]);

  const remove = useCallback(
    (id: string) => {
      if (!content) return;
      setDraft({ members: content.members.filter((m) => m.id !== id) });
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

  if (loaded.isPending) return <Spinner label="Loading the team" />;
  if (loaded.isError) {
    if (loaded.error instanceof ApiError && loaded.error.isForbidden) {
      return <PermissionState permission="settings.view" />;
    }
    return (
      <ErrorState
        title="Could not load the team"
        description={loaded.error.message}
        action={<Button onClick={() => void loaded.refetch()}>Try again</Button>}
      />
    );
  }
  if (!content) return null;

  const visible = content.members.filter((m) => !m.hidden);
  const current = visible.filter((m) => m.status === 'active').length;
  const exited = visible.filter((m) => m.status === 'exited').length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Team"
        description={`${current} on the team · ${exited} alumni · shown on spllit.app/about`}
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
              disabled={!canEdit || save.isPending || (!dirty && !neverSaved)}
            >
              {save.isPending ? 'Publishing…' : dirty || neverSaved ? 'Publish' : 'Published'}
            </Button>
          </div>
        }
      />

      {neverSaved && !dirty ? (
        <p className="text-xs text-ink-muted">
          This is the team as the site shows it today. Edit anything and press Publish — from then
          on the site follows this page.
        </p>
      ) : dirty ? (
        <p className="text-xs font-medium text-warning">
          Unpublished changes — the site still shows the last published team.
        </p>
      ) : (
        <p className="text-xs text-ink-subtle">Everything here is published.</p>
      )}

      {!canEdit ? (
        <Card className="border-warning bg-warning-muted p-4 text-sm text-ink">
          You can read this page but not change it. Editing needs the{' '}
          <code className="font-mono text-xs">settings.edit</code> permission.
        </Card>
      ) : null}

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">People</h2>
            <p className="mt-0.5 text-xs text-ink-subtle">
              Order here is order on the site. Founders get the large card; Exited moves someone to
              Alumni, faded.
            </p>
          </div>
          <Button size="sm" onClick={add} disabled={!canEdit}>
            <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Add person
          </Button>
        </div>

        <ul className="mt-4 divide-y divide-line rounded-md border border-line">
          {content.members.map((member, index) => {
            const open = openId === member.id;
            return (
              <li
                key={member.id}
                className={cn(member.status === 'exited' && !open && 'opacity-60')}
              >
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : member.id)}
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
                  <Avatar member={member} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {member.name || 'Unnamed person'}
                    </span>
                    <span className="block truncate text-xs text-ink-subtle">
                      {member.role || 'No role yet'}
                    </span>
                  </span>
                  <GroupBadge member={member} />
                  {member.status === 'exited' ? (
                    <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-ink-subtle ring-1 ring-line">
                      Exited
                    </span>
                  ) : null}
                  {member.hidden ? (
                    <span className="rounded-full bg-warning-muted px-2 py-0.5 text-[11px] font-medium text-warning">
                      Hidden
                    </span>
                  ) : null}
                </button>

                {open ? (
                  <div className="space-y-5 border-t border-line bg-surface-sunken/40 px-4 py-5 sm:px-6">
                    <PhotoPicker
                      member={member}
                      disabled={!canEdit}
                      onChange={(photo) => update(member.id, { photo })}
                    />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Name">
                        <Input
                          value={member.name}
                          disabled={!canEdit}
                          maxLength={80}
                          placeholder="Full name"
                          onChange={(e) => update(member.id, { name: e.target.value })}
                        />
                      </Field>
                      <Field
                        label="Role"
                        hint="As it should read: Founder, Engineering, Design intern…"
                      >
                        <Input
                          value={member.role}
                          disabled={!canEdit}
                          maxLength={60}
                          placeholder="Role"
                          onChange={(e) => update(member.id, { role: e.target.value })}
                        />
                      </Field>
                    </div>

                    <div className="flex flex-wrap gap-x-8 gap-y-4">
                      <Field label="Group">
                        <div>
                          <Segmented
                            value={member.group}
                            options={GROUPS}
                            disabled={!canEdit}
                            onChange={(group) => update(member.id, { group })}
                          />
                        </div>
                      </Field>
                      <Field
                        label="Status"
                        hint={
                          member.status === 'exited'
                            ? `Shown under Alumni as "Former ${(GROUPS.find((g) => g.value === member.group)?.label ?? '').toLowerCase()}", faded.`
                            : 'On the team.'
                        }
                      >
                        <div>
                          <Segmented<Status>
                            value={member.status}
                            options={[
                              { value: 'active', label: 'Current' },
                              { value: 'exited', label: 'Exited' },
                            ]}
                            disabled={!canEdit}
                            onChange={(status) => update(member.id, { status })}
                          />
                        </div>
                      </Field>
                    </div>

                    <Field
                      label="Description"
                      hint={`${member.bio.length}/${BIO_MAX} · a line or two, shown on their card`}
                    >
                      <textarea
                        value={member.bio}
                        rows={3}
                        maxLength={BIO_MAX}
                        disabled={!canEdit}
                        placeholder="What they work on, in a sentence."
                        onChange={(e) => update(member.id, { bio: e.target.value })}
                        className={cn(
                          'mt-1 w-full rounded-md border border-line bg-surface-sunken px-3 py-2 text-sm text-ink',
                          'placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25',
                        )}
                      />
                    </Field>

                    <div>
                      <p className="text-xs font-medium text-ink-muted">Profiles</p>
                      <p className="mt-0.5 text-[11px] text-ink-subtle">
                        Leave blank for none. Each one filled in becomes a button on their card.
                      </p>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        {LINK_FIELDS.map((field) => {
                          const value = member.links[field.key];
                          return (
                            <Field key={field.key} label={field.label}>
                              <Input
                                type="url"
                                inputMode="url"
                                value={value}
                                disabled={!canEdit}
                                placeholder={field.placeholder}
                                className={cn(!isHttps(value) && 'border-danger')}
                                onChange={(e) =>
                                  update(member.id, {
                                    links: { ...member.links, [field.key]: e.target.value },
                                  })
                                }
                              />
                            </Field>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                      <label className="inline-flex items-center gap-2 text-xs text-ink-muted">
                        <input
                          type="checkbox"
                          checked={member.hidden}
                          disabled={!canEdit}
                          onChange={(e) => update(member.id, { hidden: e.target.checked })}
                        />
                        Hide from the site (keep here)
                      </label>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!canEdit || index === 0}
                          onClick={() => move(index, -1)}
                          aria-label="Move up"
                        >
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!canEdit || index === content.members.length - 1}
                          onClick={() => move(index, 1)}
                          aria-label="Move down"
                        >
                          <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={!canEdit}
                          onClick={() => setRemoving(member)}
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
      </Card>

      {removing ? (
        <ConfirmDialog
          title={`Remove ${removing.name || 'this person'}?`}
          description="This takes them off the site entirely once you publish. If they have left the team, set them to Exited instead — they stay on the page under Alumni."
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
