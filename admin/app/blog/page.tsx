'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  Check,
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
 * Blog & News editor.
 *
 * Five things in the order somebody actually does them: a headline, whether it
 * is a guide or an announcement, a picture, a summary, then the post. Publish
 * puts it on spllit.app; hidden keeps it here.
 *
 * Built on the same shape as the careers editor — collapsed rows that open one
 * at a time, one visibility control rather than two overlapping ones, and a
 * line on every post saying what publishing will do to it. The lesson there was
 * that a form which cannot say whether it worked is indistinguishable from one
 * that did not.
 */

const LIVE_URL = 'https://spllit.app/blog';

type Kind = 'Blog' | 'News';

interface Post {
  slug: string;
  title: string;
  kind: Kind;
  summary: string;
  body: string;
  image: string;
  imageAlt: string;
  publishedAt: string;
  draft: boolean;
}

interface Content {
  posts: Post[];
}

const BLANK: Content = { posts: [] };

/** Lowercase, hyphenated. This becomes the public link, so it is not free text. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
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

/** One numbered step, ticked once it is satisfied. */
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

function KindChip({ post }: { post: Post }) {
  if (post.draft) {
    return (
      <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-subtle ring-1 ring-line">
        Hidden
      </span>
    );
  }
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        post.kind === 'News' ? 'bg-danger-muted text-danger' : 'bg-brand-muted text-brand',
      )}
    >
      {post.kind}
    </span>
  );
}

/**
 * Picks a file and hands back the URL it was stored at.
 *
 * The upload is its own request, made when the picture is chosen rather than
 * when the post is saved: an author picks an image long before they finish
 * writing, and folding it into the save would re-send the file on every edit.
 */
function ImagePicker({
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
      const result = await apiUpload<{ url: string }>('/blog/image', file);
      onChange(result.url);
      toast.success('Image uploaded.');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not upload that image.');
    } finally {
      setBusy(false);
      // Cleared so choosing the same file twice still fires a change.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          className="hidden"
          onChange={(e) => void pick(e.target.files?.[0])}
        />
        <Button
          size="sm"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          )}
          {busy ? 'Uploading…' : value ? 'Replace image' : 'Choose image'}
        </Button>

        {value ? (
          <>
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs font-medium text-ink hover:border-line-strong"
            >
              Open
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
            <Button size="sm" variant="danger" disabled={disabled} onClick={() => onChange('')}>
              Remove
            </Button>
          </>
        ) : null}
      </div>

      {value ? (
        /* An arbitrary uploaded URL, shown once in an admin tool. next/image
           would need every possible host allowlisted in this app as well as
           on the site, to optimise a thumbnail only staff ever load. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          className="mt-3 max-h-40 rounded-md border border-line bg-surface-sunken object-contain p-2"
        />
      ) : null}

      <div className="mt-2">
        <Input
          type="url"
          inputMode="url"
          value={value}
          placeholder="…or paste an image link"
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

export default function BlogAdminPage() {
  const { can } = useAuth();
  const toast = useToast();
  const canEdit = can('settings.edit');

  const loaded = useQuery({
    queryKey: ['blog'],
    queryFn: () => api<{ content: Content | null }>('/blog'),
  });

  const [draft, setDraft] = useState<Content | null>(null);
  const [dirty, setDirty] = useState(false);
  const [openPost, setOpenPost] = useState<number | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);

  const content = draft ?? loaded.data?.content ?? (loaded.isSuccess ? BLANK : null);

  const save = useMutation({
    mutationFn: (body: Content) => api('/blog', { method: 'PUT', body }),
    onSuccess: () => {
      setDirty(false);
      toast.success('Published. The site picks it up within about half a minute.');
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Could not publish the changes.'),
  });

  const updatePost = useCallback(
    (index: number, patch: Partial<Post>) => {
      if (!content) return;
      setDraft({
        ...content,
        posts: content.posts.map((post, i) => (i === index ? { ...post, ...patch } : post)),
      });
      setDirty(true);
    },
    [content],
  );

  const movePost = useCallback(
    (index: number, delta: number) => {
      if (!content) return;
      const next = [...content.posts];
      const target = index + delta;
      const a = next[index];
      const b = next[target];
      if (!a || !b) return;
      next[index] = b;
      next[target] = a;
      setDraft({ ...content, posts: next });
      setOpenPost((cur) => (cur === index ? target : cur === target ? index : cur));
      setDirty(true);
    },
    [content],
  );

  const removePost = useCallback(
    (index: number) => {
      if (!content) return;
      setDraft({ ...content, posts: content.posts.filter((_, i) => i !== index) });
      setOpenPost(null);
      setDirty(true);
      setRemoving(null);
    },
    [content],
  );

  const addPost = useCallback(() => {
    if (!content) return;
    setDraft({
      ...content,
      posts: [
        {
          slug: '',
          title: '',
          kind: 'Blog',
          summary: '',
          body: '',
          image: '',
          imageAlt: '',
          publishedAt: todayISO(),
          draft: true,
        },
        ...content.posts,
      ],
    });
    // Newest at the top, and opened: writing always follows adding.
    setOpenPost(0);
    setDirty(true);
  }, [content]);

  const duplicateSlugs = useMemo(() => {
    if (!content) return [];
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const post of content.posts) {
      const slug = post.slug.trim();
      if (!slug) continue;
      if (seen.has(slug)) dupes.add(slug);
      seen.add(slug);
    }
    return [...dupes];
  }, [content]);

  /** What the server will refuse, said here first. */
  const blocking = useMemo(() => {
    if (!content) return [];
    return content.posts
      .map((post, index) => ({ post, index }))
      .filter(({ post }) => !post.title.trim() || !post.summary.trim() || !post.slug.trim());
  }, [content]);

  const publish = useCallback(() => {
    if (!content) return;
    if (duplicateSlugs.length > 0) {
      toast.error(`Two posts share the link "${duplicateSlugs[0]}" — links have to be unique.`);
      return;
    }
    if (blocking.length > 0) {
      const first = blocking[0];
      toast.error('Every post needs a headline and a summary before it can be published.');
      setOpenPost(first ? first.index : null);
      return;
    }
    save.mutate(content);
  }, [content, duplicateSlugs, blocking, save, toast]);

  if (loaded.isPending) return <Spinner label="Loading posts" />;
  if (loaded.isError) {
    if (loaded.error instanceof ApiError && loaded.error.isForbidden) {
      return <PermissionState permission="settings.view" />;
    }
    return (
      <ErrorState
        title="Could not load the blog"
        description={loaded.error.message}
        action={<Button onClick={() => void loaded.refetch()}>Try again</Button>}
      />
    );
  }
  if (!content) return null;

  const liveCount = content.posts.filter((post) => !post.draft).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Blog & News"
        description={`${liveCount} on the site · ${content.posts.length} in total`}
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
            Open spllit.app/blog
          </a>{' '}
          to see it. Hidden posts do not appear there.
        </p>
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
            <h2 className="text-sm font-semibold text-ink">Posts</h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Click one to edit it. The three guides written into the site are not listed here and
              stay published either way.
            </p>
          </div>
          {canEdit ? (
            <Button variant="primary" onClick={addPost}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />
              Write a post
            </Button>
          ) : null}
        </div>

        {content.posts.length === 0 ? (
          <p className="mt-4 rounded-md border border-dashed border-line bg-surface-sunken p-6 text-center text-sm text-ink-muted">
            Nothing written here yet. The site still shows the guides built into it.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {content.posts.map((post, index) => {
              const expanded = openPost === index;
              const dupe = duplicateSlugs.includes(post.slug.trim());
              const incomplete = !post.title.trim() || !post.summary.trim();

              return (
                <li
                  key={index}
                  className={cn(
                    'overflow-hidden rounded-lg border bg-surface-sunken',
                    dupe ? 'border-danger' : incomplete ? 'border-warning' : 'border-line',
                  )}
                >
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => setOpenPost(expanded ? null : index)}
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
                          {post.title || <span className="text-ink-subtle">Untitled post</span>}
                        </span>
                        <span className="block truncate text-xs text-ink-muted">
                          {post.publishedAt}
                          {post.summary ? ` · ${post.summary}` : ''}
                        </span>
                      </span>
                      <KindChip post={post} />
                    </button>

                    <span className="flex shrink-0 items-center gap-1">
                      <Button size="sm" onClick={() => movePost(index, -1)} disabled={index === 0} title="Move up">
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => movePost(index, 1)}
                        disabled={index === content.posts.length - 1}
                        title="Move down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={!canEdit}
                        title="Delete this post"
                        onClick={() => setRemoving(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </span>
                  </div>

                  {expanded ? (
                    <div className="border-t border-line bg-surface p-4">
                      <Step n={1} title="Headline" done={!!post.title.trim()}>
                        <Field label="Headline" hint="What somebody sees on the card and in search.">
                          <Input
                            value={post.title}
                            placeholder="We are hiring across engineering and growth"
                            onChange={(e) => {
                              const title = e.target.value;
                              // The link tracks the headline until somebody
                              // edits it by hand. After that it is public and
                              // must not move under anyone holding it.
                              const autoSlug = !post.slug || post.slug === slugify(post.title);
                              updatePost(
                                index,
                                autoSlug ? { title, slug: slugify(title) } : { title },
                              );
                            }}
                          />
                        </Field>
                      </Step>

                      <Step n={2} title="Blog or News" done>
                        <div className="flex gap-2">
                          {(['Blog', 'News'] as const).map((value) => {
                            const active = post.kind === value;
                            return (
                              <button
                                key={value}
                                type="button"
                                disabled={!canEdit}
                                onClick={() => updatePost(index, { kind: value })}
                                className={cn(
                                  'h-9 flex-1 rounded-md border text-sm font-medium transition-colors duration-snap',
                                  active && value === 'Blog' && 'border-brand bg-brand-muted text-brand',
                                  active && value === 'News' && 'border-danger bg-danger-muted text-danger',
                                  !active && 'border-line bg-surface-sunken text-ink-muted hover:text-ink',
                                )}
                              >
                                {value}
                              </button>
                            );
                          })}
                        </div>
                        <p className="mt-2 text-[11px] text-ink-subtle">
                          {post.kind === 'News'
                            ? 'Something that happened, dated. Shown with a red label.'
                            : 'A guide meant to still be true next term. Shown with a green label.'}
                        </p>
                      </Step>

                      <Step n={3} title="Picture" done={!!post.image.trim()} note="optional">
                        <ImagePicker
                          value={post.image}
                          disabled={!canEdit}
                          onChange={(image) => updatePost(index, { image })}
                        />
                        <div className="mt-3">
                          <Field
                            label="Describe the picture"
                            hint="For anyone who cannot see it. Do not repeat the headline."
                          >
                            <Input
                              value={post.imageAlt}
                              placeholder="Four students loading bags into a cab at night"
                              onChange={(e) => updatePost(index, { imageAlt: e.target.value })}
                            />
                          </Field>
                        </div>
                      </Step>

                      <Step n={4} title="Summary" done={!!post.summary.trim()}>
                        <Field
                          label="Summary"
                          hint="One or two sentences. This is the line people decide on."
                        >
                          <Textarea
                            rows={2}
                            value={post.summary}
                            onChange={(v) => updatePost(index, { summary: v })}
                          />
                        </Field>
                      </Step>

                      <Step n={5} title="The post" done={!!post.body.trim()}>
                        <Field
                          label="Write it here"
                          hint="Leave a blank line between paragraphs. Plain text — no formatting codes."
                        >
                          <Textarea
                            rows={12}
                            value={post.body}
                            onChange={(v) => updatePost(index, { body: v })}
                          />
                        </Field>
                      </Step>

                      <Step n={6} title="Publish" done={!post.draft}>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Where it shows">
                            <div className="mt-1 flex gap-2">
                              {[
                                { label: 'Hidden', value: true },
                                { label: 'On the site', value: false },
                              ].map((option) => {
                                const active = post.draft === option.value;
                                return (
                                  <button
                                    key={option.label}
                                    type="button"
                                    disabled={!canEdit}
                                    onClick={() => updatePost(index, { draft: option.value })}
                                    className={cn(
                                      'h-9 flex-1 rounded-md border text-sm font-medium transition-colors duration-snap',
                                      active && option.value && 'border-line-strong bg-surface-raised text-ink',
                                      active && !option.value && 'border-brand bg-brand-muted text-brand',
                                      !active && 'border-line bg-surface-sunken text-ink-muted hover:text-ink',
                                    )}
                                  >
                                    {option.label}
                                  </button>
                                );
                              })}
                            </div>
                          </Field>
                          <Field label="Date" hint="Orders the list and shows on the post.">
                            <Input
                              type="date"
                              value={post.publishedAt}
                              onChange={(e) => updatePost(index, { publishedAt: e.target.value })}
                            />
                          </Field>
                        </div>
                      </Step>

                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                        <span className="max-w-[300px] text-[11px] text-ink-subtle">
                          The public link for this post.
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-[11px] text-ink-subtle">/blog/</span>
                          <Input
                            value={post.slug}
                            onChange={(e) => updatePost(index, { slug: slugify(e.target.value) })}
                            className="h-8 w-[220px] font-mono text-[11px]"
                          />
                        </span>
                      </div>

                      {dupe ? (
                        <p className="mt-2 text-xs text-danger">
                          Another post uses this link. One of them would be unreachable.
                        </p>
                      ) : null}
                      <p
                        className={cn(
                          'mt-2 text-xs',
                          incomplete
                            ? 'text-warning'
                            : post.draft
                              ? 'text-ink-subtle'
                              : 'text-brand',
                        )}
                      >
                        {incomplete
                          ? 'Needs a headline and a summary before it can be published.'
                          : post.draft
                            ? 'Hidden, so publishing changes nothing on the site. Choose “On the site” when it is ready.'
                            : 'Goes live on spllit.app/blog when you press Publish.'}
                      </p>
                    </div>
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
          // Deleting edits the local draft; nothing is recorded until Publish,
          // so a mandatory reason here would collect text that goes nowhere.
          requireReason={false}
          title="Delete this post?"
          confirmLabel="Delete"
          description="It comes off the site when you next publish, and its link stops resolving. If you only want it out of sight for now, set it to Hidden instead — that keeps the text."
          onCancel={() => setRemoving(null)}
          onConfirm={() => removePost(removing)}
        />
      ) : null}
    </div>
  );
}
