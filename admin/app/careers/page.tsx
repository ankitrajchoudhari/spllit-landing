'use client';

import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Plus,
  Trash2,
} from 'lucide-react';

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
  defaultOpen = false,
  children,
}: {
  title: string;
  description: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
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

const APPLICATION_ENDPOINT = 'https://api.spllit.app/api/public/careers/application';

/**
 * The exact script to paste into a Google Form, with one role filled in.
 *
 * ROLE_ID is substituted here rather than left as a placeholder, because a
 * wrong one fails as a 404 from the endpoint and no email — a silence nobody
 * notices until an applicant says they never heard back. The secret stays a
 * placeholder: it is not sent to this console, and it should not be.
 */
function appsScript(roleId: string): string {
  return `const ENDPOINT = '${APPLICATION_ENDPOINT}';
const SECRET   = 'PASTE_THE_SECRET_HERE';
const ROLE_ID  = '${roleId}';

// Must match the question titles on your form, word for word.
const EMAIL_QUESTION = 'Email';
const NAME_QUESTION  = 'Full name';

/** Run this by hand first. It checks the secret and the role, and sends nothing. */
function check() {
  const res = post({ email: 'check@example.com', name: 'Check', roleId: ROLE_ID,
                     submissionId: 'check-' + Date.now(), dryRun: true });
  const code = res.getResponseCode();
  if (code === 200) { Logger.log('OK — secret and role id are both good.'); return; }
  if (code === 401) throw new Error('The SECRET above does not match the one on the server.');
  if (code === 404) throw new Error('No role on the site has id "' + ROLE_ID + '".');
  if (code === 503) throw new Error('The server has no careers secret set at all.');
  throw new Error('Unexpected ' + code + ': ' + res.getContentText());
}

function onSubmit(e) {
  const answers = {};
  e.response.getItemResponses().forEach(r => {
    answers[r.getItem().getTitle().trim()] = r.getResponse();
  });

  const email = answers[EMAIL_QUESTION] || e.response.getRespondentEmail();
  if (!email) return;                       // nothing to send to

  const res = post({
    email: email,
    name: answers[NAME_QUESTION] || '',
    roleId: ROLE_ID,
    submissionId: e.response.getId()        // stops a retry sending twice
  });

  // Throwing makes a failure visible: it shows in Executions, and Google
  // emails you. Swallowing it is how "nobody got a confirmation" goes unnoticed.
  if (res.getResponseCode() !== 202) {
    throw new Error('Spllit rejected it: ' + res.getResponseCode() + ' ' + res.getContentText());
  }
}

function post(payload) {
  return UrlFetchApp.fetch(ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-spllit-careers-secret': SECRET },
    muteHttpExceptions: true,               // so the code can be read, not thrown
    payload: JSON.stringify(payload)
  });
}

// Run this once, by hand, to attach onSubmit to the form.
function install() {
  ScriptApp.newTrigger('onSubmit')
    .forForm(FormApp.getActiveForm())
    .onFormSubmit()
    .create();
}`;
}

/**
 * A numbered step inside the role editor.
 *
 * Posting a role is five things done in order, and the panel used to present
 * them as one undifferentiated column of fields — so "what else does this
 * need?" could only be answered by remembering. Numbering them, and ticking
 * the ones already satisfied, makes it answerable by looking.
 *
 * Step four cannot be ticked: whether the script was pasted into the Google
 * Form happens on Google, and this console has no way to know. Claiming a tick
 * there would be worse than leaving it open.
 */
function Step({
  n,
  title,
  done,
  note,
  children,
}: {
  n: number;
  title: string;
  done?: boolean;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 first:mt-0">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span
          className={cn(
            'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
            done ? 'bg-brand text-brand-fg' : 'bg-surface-sunken text-ink-subtle ring-1 ring-line',
          )}
          aria-hidden
        >
          {done ? <Check className="h-3 w-3" /> : n}
        </span>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink">{title}</h4>
        {note ? <span className="text-[11px] normal-case text-ink-subtle">{note}</span> : null}
      </div>
      <div className="mt-2.5 sm:pl-[32px]">{children}</div>
    </section>
  );
}

/** Marks a value that has to be changed before the script will work. */
function Swap({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-[3px] bg-warning-muted px-1 font-semibold text-warning ring-1 ring-warning/40">
      {children}
    </span>
  );
}

/**
 * Where a role shows, as one choice instead of two.
 *
 * It used to be a "published" checkbox and a separate open/closed pair, which
 * between them spelled four states for three real ones, and left the common
 * mistake wide open: add a role, fill it in, press Publish, and see nothing on
 * the site, because the checkbox at the bottom of the panel was never ticked.
 * One control, three buttons, and the site can only be in one of them.
 */
type Visibility = 'hidden' | 'open' | 'closed';

function visibilityOf(role: Role): Visibility {
  if (role.draft) return 'hidden';
  return (role.status ?? 'open') === 'closed' ? 'closed' : 'open';
}

/** Hidden keeps whatever open/closed it had; it does not matter while hidden. */
function visibilityPatch(value: Visibility): Partial<Role> {
  return value === 'hidden' ? { draft: true } : { draft: false, status: value };
}

const VISIBILITY: Record<
  Visibility,
  { label: string; help: string; active: string; chip: string }
> = {
  hidden: {
    label: 'Hidden',
    help: 'Only you can see it. Nothing about it appears on spllit.app.',
    active: 'border-line-strong bg-surface-raised text-ink',
    chip: 'bg-surface text-ink-subtle ring-1 ring-line',
  },
  open: {
    label: 'Open',
    help: 'On the site with an Apply button. Needs a Google Form link.',
    active: 'border-brand bg-brand-muted text-brand',
    chip: 'bg-brand-muted text-brand',
  },
  closed: {
    label: 'Closed',
    help: 'Still listed, marked closed in red, with no Apply button.',
    active: 'border-danger bg-danger-muted text-danger',
    chip: 'bg-danger-muted text-danger',
  },
};

/**
 * What pressing Publish will actually do to this role, said plainly.
 *
 * The console cannot show a preview, so it says the consequence instead. Most
 * of the confusion here is one of three things: no title (the site drops the
 * role), no form link (Publish refuses it), or still Hidden (Publish works and
 * nothing changes on the site, which reads as a broken button).
 */
function outcomeFor(role: Role, visibility: Visibility, needsLink: boolean) {
  if (!role.title.trim()) {
    return { tone: 'text-warning', text: 'Give it a title. A role without one is not shown at all.' };
  }
  if (needsLink) {
    return {
      tone: 'text-warning',
      text: 'Open with no form link, so Publish will refuse it. Paste the Google Form link above, or set it to Hidden until you have one.',
    };
  }
  if (visibility === 'hidden') {
    return {
      tone: 'text-ink-subtle',
      text: 'Hidden, so publishing changes nothing on the site. Choose Open above when you want applications.',
    };
  }
  if (visibility === 'closed') {
    return {
      tone: 'text-ink-subtle',
      text: 'Listed on the site and marked closed in red, with no Apply button.',
    };
  }
  return {
    tone: 'text-brand',
    text: 'Goes live on spllit.app/careers with an Apply button when you press Publish.',
  };
}

/** The same word the control uses, so the row and the editor agree. */
function StatusChip({ role }: { role: Role }) {
  const state = visibilityOf(role);
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        VISIBILITY[state].chip,
      )}
    >
      {VISIBILITY[state].label}
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
        `"${first?.role.title || first?.role.id}" is set to Open but has no Google Form link. Paste the link, or set it to Hidden until you have one.`,
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
        description={`${liveCount} open on the site · ${content.roles.length} in total`}
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
      {/* A four-second toast is easy to miss, so the state is stated here and
          stays stated. "I pressed Publish and cannot see anything" is usually
          this line having said the work was already published. */}
      {dirty ? (
        <p className="text-xs font-medium text-warning">
          Unpublished changes — the site still shows the last published version.
        </p>
      ) : (
        <p className="text-xs text-ink-subtle">
          Everything here is published.{' '}
          <a
            href={LIVE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-ink"
          >
            Open spllit.app/careers
          </a>{' '}
          to see it. Only roles set to Open or Closed appear there.
        </p>
      )}

      {!canEdit ? (
        <Card className="border-warning bg-warning-muted p-4 text-sm text-ink">
          You can read this page but not change it. Editing needs the{' '}
          <code className="font-mono text-xs">settings.edit</code> permission.
        </Card>
      ) : null}

      {/* Opens by itself while the board is empty, which is exactly when
          somebody is doing this for the first time, and stays out of the way
          afterwards. */}
      <Disclosure
        title="How to post a role"
        description="Read this first if it is your first one. The role itself is numbered 1 to 5."
        defaultOpen={content.roles.length === 0}
      >
        <ol className="space-y-3 text-sm text-ink-muted">
          <li>
            <strong className="text-ink">1. Make the Google Form first.</strong> A role cannot go
            live without one. In Google Forms start a blank form and ask for the things you will
            actually sort on — name, email, phone, course and year, and a link to a CV or portfolio.
            Turn on <em>Collect email addresses</em>. Then press <strong>Send</strong>, open the
            link tab and copy the link.
          </li>
          <li>
            <strong className="text-ink">2. Press Add role</strong> and fill the top four boxes.
            Title is what somebody would search for, so &ldquo;Campus Growth Intern&rdquo; rather
            than &ldquo;Intern (Growth) 2026&rdquo;. Team, Location and Type are the three filters
            on the public page, so keep them consistent between roles.
          </li>
          <li>
            <strong className="text-ink">3. Paste the form link</strong> into Google Form link, then
            press <strong>Open</strong> beside it. If it does not load for you it will not load for
            an applicant either.
          </li>
          <li>
            <strong className="text-ink">4. Write the Summary and Responsibilities.</strong> Summary
            is one or two sentences on what the person will actually do — it is the line an
            applicant decides on. Responsibilities are one per line; three or four beats ten.
          </li>
          <li>
            <strong className="text-ink">5. Set Where this role shows to Open.</strong> A new role
            starts Hidden, so this is the step that puts it on the site. Closes on is optional — set
            it and the role marks itself closed after that date without you coming back.
          </li>
          <li>
            <strong className="text-ink">6. Press Publish.</strong> The site picks it up within
            about half a minute. Nothing you type here reaches spllit.app until you press it.
          </li>
        </ol>
        <p className="mt-4 text-xs text-ink-subtle">
          Applicants only get a confirmation email from Spllit if you also paste the script under
          Confirmation emails into that form. Without it the application still lands in the form
          responses — the applicant just hears nothing back.
        </p>
      </Disclosure>

      {/* Roles are the point of the page, so nothing else is expanded above
          them once the board has something on it. */}
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
              const visibility = visibilityOf(role);
              const needsLink = visibility === 'open' && !role.applyUrl.trim();
              const outcome = outcomeFor(role, visibility, needsLink);

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
                      <Step n={1} title="The role" done={!!role.title.trim() && !!role.team.trim()}>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Title" hint="As an applicant would search for it.">
                            <Input
                              value={role.title}
                              placeholder="Campus Growth Intern"
                              onChange={(e) => {
                                const title = e.target.value;
                                // Keep the id tracking the title until somebody
                                // edits the id by hand. After that it is a
                                // public link and must not move under anyone.
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
                          <Field label="Team" hint="Which part of Spllit it sits in. Also a filter.">
                            <Input
                              value={role.team}
                              placeholder="Growth"
                              onChange={(e) => updateRole(index, { team: e.target.value })}
                            />
                          </Field>
                          <Field label="Location" hint="Where the work happens. Also a filter.">
                            <Picker
                              value={role.location}
                              options={LOCATIONS}
                              onChange={(location) => updateRole(index, { location })}
                            />
                          </Field>
                          <Field label="Type" hint="Internship, full-time, and so on. Also a filter.">
                            <Picker
                              value={role.type}
                              options={TYPES}
                              onChange={(type) => updateRole(index, { type })}
                            />
                          </Field>
                        </div>
                      </Step>

                      <Step
                        n={2}
                        title="What it involves"
                        done={!!role.summary.trim() || role.responsibilities.length > 0}
                      >
                        <Field
                          label="Summary"
                          hint="One or two sentences on what the person will actually do."
                        >
                          <Textarea
                            rows={2}
                            value={role.summary}
                            onChange={(v) => updateRole(index, { summary: v })}
                          />
                        </Field>
                        <div className="mt-3">
                          <Field label="Responsibilities" hint="One per line. Three or four is plenty.">
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
                      </Step>

                      <Step n={3} title="The application form" done={isWebLink(role.applyUrl)}>
                        <Field
                          label="Google Form link"
                          hint="In Google Forms press Send, open the link tab, and paste the link here."
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
                      </Step>

                      {/* Not tickable: whether the script was pasted happens on
                          Google, and this console cannot see it. */}
                      <Step n={4} title="The confirmation email" note="once per form">
                        <div className="rounded-md border border-line bg-surface-sunken p-3">
                          <p className="text-[11px] leading-relaxed text-ink-subtle">
                            Google hosts the form, so submitting it tells Spllit nothing on its own.
                            Copy this, paste it into the form under{' '}
                            <strong className="text-ink-muted">⋮ → Apps Script</strong>, replace the
                            two highlighted values, then run{' '}
                            <strong className="text-ink-muted">check()</strong> and{' '}
                            <strong className="text-ink-muted">install()</strong>, in that order.
                          </p>
                          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] text-ink-subtle">
                              <code className="font-mono text-ink-muted">ROLE_ID</code> already set to{' '}
                              <code className="font-mono text-brand">{role.id || '…'}</code>
                            </span>
                            <Button
                              size="sm"
                              disabled={!role.id}
                              onClick={() => {
                                navigator.clipboard
                                  .writeText(appsScript(role.id))
                                  .then(() =>
                                    toast.success(
                                      'Script copied. Paste it into the Google Form for this role, under Apps Script.',
                                    ),
                                  )
                                  .catch(() => toast.error('Could not reach the clipboard.'));
                              }}
                            >
                              <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                              Copy script
                            </Button>
                          </div>
                          <p className="mt-2 text-[11px] text-ink-subtle">
                            Skip this and the application still reaches the form responses — the
                            applicant just hears nothing back. Full instructions are under
                            Confirmation emails below.
                          </p>
                        </div>
                      </Step>

                      <Step n={5} title="Go live" done={visibility !== 'hidden'}>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Where this role shows">
                            <div className="mt-1 flex gap-2">
                              {(['hidden', 'open', 'closed'] as const).map((value) => {
                                const active = visibility === value;
                                return (
                                  <button
                                    key={value}
                                    type="button"
                                    disabled={!canEdit}
                                    onClick={() => updateRole(index, visibilityPatch(value))}
                                    className={cn(
                                      'h-9 flex-1 rounded-md border text-sm font-medium transition-colors duration-snap',
                                      active
                                        ? VISIBILITY[value].active
                                        : 'border-line bg-surface-sunken text-ink-muted hover:text-ink',
                                    )}
                                  >
                                    {VISIBILITY[value].label}
                                  </button>
                                );
                              })}
                            </div>
                            <span className="mt-1 block text-[11px] text-ink-subtle">
                              {VISIBILITY[visibility].help}
                            </span>
                          </Field>
                          <Field
                            label="Closes on"
                            hint="Optional. The site marks the role closed by itself once this date passes."
                          >
                            <Input
                              type="date"
                              value={toDateInput(role.closesAt)}
                              onChange={(e) =>
                                updateRole(index, { closesAt: fromDateInput(e.target.value) })
                              }
                            />
                          </Field>
                        </div>
                      </Step>

                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                        <span className="max-w-[300px] text-[11px] text-ink-subtle">
                          The public link for this role, and the ROLE_ID the form script needs.
                        </span>
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
                      <p className={cn('mt-2 text-xs', outcome.tone)}>{outcome.text}</p>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* The page copy is fixed in content/careers.ts on the site. Roles are
          the only thing here that changes without a deploy, so they are the
          only thing this page edits. */}
      <p className="px-1 text-xs text-ink-subtle">
        The heading and the paragraphs on spllit.app/careers are part of the site itself and are
        not edited here. This page sets which roles are open.
      </p>

      <Disclosure
        title="Confirmation emails"
        description="One-time setup per form, so applicants hear back from Spllit."
      >
        <p className="text-sm text-ink-muted">
          Google hosts the form, so submitting it tells Spllit nothing on its own. Pasting this
          script into the form is what sends the applicant a confirmation. Without it the
          application still lands in the form responses — the applicant just hears nothing back.
        </p>

        {/* Named before the script appears, so the highlighted values already
            mean something by the time they are on screen. */}
        <div className="mt-4 rounded-md border border-warning bg-warning-muted p-3">
          <p className="text-xs font-semibold text-ink">Replace the highlighted values</p>
          <ol className="mt-2 space-y-2 text-xs text-ink-muted">
            <li>
              <Swap>PASTE_THE_SECRET_HERE</Swap> — the value of{' '}
              <code className="font-mono">CAREERS_WEBHOOK_SECRET</code>, which is in{' '}
              <code className="font-mono">backend/.env</code>. Keep the quotes around it.
            </li>
            <li>
              <Swap>Email</Swap> and <Swap>Full name</Swap> — the titles of those two questions on
              your form, word for word. If yours is called &ldquo;Your email address&rdquo;, then
              that is what goes here.
            </li>
          </ol>
          <p className="mt-2.5 text-[11px] text-ink-subtle">
            ROLE_ID needs no editing — use the copy button next to a role below and it comes with
            the right one already in it.
          </p>
        </div>

        <pre className="mt-4 overflow-x-auto rounded-md border border-line bg-surface-sunken p-4 text-[12px] leading-relaxed text-ink-muted">
{`const ENDPOINT = '`}
          <span className="text-ink">{APPLICATION_ENDPOINT}</span>
{`';
const SECRET   = '`}
          <Swap>PASTE_THE_SECRET_HERE</Swap>
{`';
const ROLE_ID  = '`}
          <span className="text-brand">campus-growth-intern</span>
{`';   // already filled in

// Must match the question titles on your form, word for word.
const EMAIL_QUESTION = '`}
          <Swap>Email</Swap>
{`';
const NAME_QUESTION  = '`}
          <Swap>Full name</Swap>
{`';

function onSubmit(e) { … }   // the rest sends the submission to Spllit
function install()  { … }   // run this one by hand, once`}
        </pre>

        <ol className="mt-4 space-y-2 text-sm text-ink-muted">
          <li>
            1. Copy the script for the role, using the button beside it below.
          </li>
          <li>
            2. Open that Google Form, then <strong className="text-ink">⋮ → Apps Script</strong>.
          </li>
          <li>
            3. Delete whatever is in the editor, paste the script, and replace the two highlighted
            values. Save.
          </li>
          <li>
            4. Run <strong className="text-ink">check()</strong> from the dropdown at the top and
            accept the permission prompt. It sends no email — it just proves the secret and the
            role id are right, and says which one is wrong if not. Do not go on until it logs OK.
          </li>
          <li>
            5. Run <strong className="text-ink">install()</strong> once. That is the step that
            attaches it to submissions — without it nothing runs, however correct the script is.
          </li>
          <li>
            6. Submit the form yourself once. The confirmation should arrive within a minute. If it
            does not, open <strong className="text-ink">Executions</strong> in Apps Script: a
            failed run there says exactly what the server answered.
          </li>
        </ol>

        {/* The button lives with the role rather than here. A role needs its
            script while it is still hidden and its form is being built, which
            is before it would appear in any list of what is on the site. */}
        <p className="mt-4 rounded-md border border-line bg-surface-sunken p-3 text-xs text-ink-muted">
          Every role has its own <strong className="text-ink">Copy script</strong> button, in the
          role itself beside its Google Form link. What it copies always carries the link id that
          role currently has — rename a role and the script corrects itself, with nothing to edit.
        </p>

        <dl className="mt-4 grid gap-2 text-[12px] text-ink-subtle sm:grid-cols-[130px_1fr]">
          <dt className="font-medium text-ink-muted">Sent from</dt>
          <dd className="font-mono">careers@career.spllit.app</dd>
          <dt className="font-medium text-ink-muted">Replies go to</dt>
          <dd className="font-mono">career@spllit.app</dd>
          <dt className="font-medium text-ink-muted">Delivery webhook</dt>
          <dd className="font-mono">https://api.spllit.app/webhooks/resend</dd>
          <dt className="font-medium text-ink-muted">Events to send</dt>
          <dd className="font-mono">email.bounced, email.complained</dd>
        </dl>

        <p className="mt-3 text-[12px] text-ink-subtle">
          Those are the only two events acted on: a hard bounce or a spam complaint suppresses
          that address so Spllit stops mailing it. Sending the others is harmless but pointless.
        </p>

        <p className="mt-3 text-[12px] text-ink-subtle">
          The endpoint refuses anything without the secret, and only sends for a role id that is on
          the site — so it cannot be used to mail arbitrary people. A wrong ROLE_ID is answered with
          a 404 and no email, which is why the copy buttons above fill it in.
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
