'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Check, CircleCheck, Copy, Share2, TriangleAlert, Users } from 'lucide-react';

import { cn, formatRelative } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ShareSheet } from '@/components/invite/share-sheet';
import { Avatar } from '@/components/ui/avatar';
import { usersService } from '@/lib/services/users';
import { useAuth } from '@/lib/auth/auth-provider';

const SHARE_MESSAGE =
  "I'm using Spllit to find people going the same way on campus — rides, group rides, the lot. Join me:";

function Bullet({
  tone,
  children,
}: {
  tone: 'yes' | 'no';
  children: React.ReactNode;
}) {
  const Icon = tone === 'yes' ? CircleCheck : TriangleAlert;
  return (
    <li className="flex items-start gap-2.5">
      <Icon
        className={cn(
          'mt-px h-4 w-4 shrink-0',
          tone === 'yes' ? 'text-brand' : 'text-warning',
        )}
      />
      <span className="text-[13px] leading-relaxed text-ink-muted">{children}</span>
    </li>
  );
}

export default function InvitePage() {
  const { profile } = useAuth();
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const invites = useQuery({
    queryKey: ['invites'],
    queryFn: () => usersService.invites(),
    enabled: Boolean(profile),
  });

  /**
   * Built from the username rather than a separate referral code — the handle
   * is already unique and already public, so a second identifier would be one
   * more thing to keep in sync for no gain.
   *
   * `?ref=` is captured on arrival and applied at signup; see lib/auth/referral.
   */
  const origin = typeof window === 'undefined' ? 'https://spllit.app' : window.location.origin;
  const link = profile?.username ? `${origin}/?ref=${profile.username}` : origin;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is permission-gated and blocked outright in some in-app
      // browsers. The field is selectable, so failing quietly still leaves a
      // way to copy by hand.
    }
  };

  const share = async () => {
    // Native sheet where the OS provides one; the in-app list otherwise.
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Join me on Spllit', text: SHARE_MESSAGE, url: link });
        return;
      } catch {
        // Cancelled, or unavailable despite the feature check — fall through.
      }
    }
    setShareOpen(true);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-8">
      <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
        <div className="relative bg-brand-muted px-6 py-8 sm:px-8">
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-brand">
            <Users className="h-3.5 w-3.5" />
            Invite
          </span>
          <h1 className="mt-3 max-w-sm font-display text-[30px] font-bold uppercase leading-[1.05] tracking-[-0.03em] text-ink sm:text-[38px]">
            Bring your
            <br />
            campus along
          </h1>
          <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-ink-muted">
            Spllit only works when the people going your way are on it. Share your
            link with your batch, your hostel, your lab.
          </p>
        </div>

        <div className="border-t border-line px-6 py-5 sm:px-8">
          <label
            htmlFor="invite-link"
            className="mb-2 block text-[12px] font-medium text-ink-muted"
          >
            Share your link
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {profile ? (
              <input
                id="invite-link"
                readOnly
                value={link}
                onFocus={(event) => event.currentTarget.select()}
                className="h-10 min-w-0 flex-1 rounded-full border border-line bg-surface-sunken px-4 text-[13px] text-ink-muted outline-none focus:border-brand"
              />
            ) : (
              <Skeleton className="h-10 flex-1 rounded-full" />
            )}

            <Button variant="secondary" onClick={() => void copy()} className="rounded-full">
              {copied ? <Check className="h-4 w-4 text-brand" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button onClick={() => void share()} className="rounded-full">
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>

          {!profile?.username ? (
            <p className="mt-2 text-[12px] text-ink-subtle">
              Finish onboarding to get a personal link.{' '}
              <Link href="/profile" className="font-medium text-ink-muted hover:text-ink">
                Set a username
              </Link>
            </p>
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-5 shadow-soft">
          <h2 className="font-display text-[15px] font-semibold tracking-[-0.01em] text-ink">
            They get
          </h2>
          <ul className="mt-3 space-y-2.5">
            <Bullet tone="yes">
              Rides and group rides already running on <strong className="font-medium text-ink">your campus</strong>, not a
              city-wide feed.
            </Bullet>
            <Bullet tone="yes">
              A verified batch to travel with — everyone signs in with an institute email.
            </Bullet>
          </ul>
        </div>

        <div className="rounded-xl border border-line bg-surface p-5 shadow-soft">
          <h2 className="font-display text-[15px] font-semibold tracking-[-0.01em] text-ink">
            You get
          </h2>
          <ul className="mt-3 space-y-2.5">
            <Bullet tone="yes">
              More people going your way, which is the whole point — an empty map matches nobody.
            </Bullet>
            <Bullet tone="no">
              No cash reward yet. This shares the app; it does not pay out.
            </Bullet>
          </ul>
        </div>
      </div>

      <section className="rounded-xl border border-line bg-surface p-5 shadow-soft">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[15px] font-semibold tracking-[-0.01em] text-ink">
            Invited friends
          </h2>
          {invites.data ? (
            <span className="text-[12.5px] text-ink-muted">
              <strong className="font-semibold text-ink">{invites.data.joined}</strong> joined
              {invites.data.total > invites.data.joined
                ? ` · ${invites.data.total - invites.data.joined} signed up`
                : ''}
            </span>
          ) : null}
        </div>

        {invites.isPending ? (
          <div className="mt-4 space-y-2">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ) : (invites.data?.items.length ?? 0) === 0 ? (
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
            Nobody yet. Anyone who signs up through your link shows up here.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {invites.data?.items.map((person) => (
              <li key={person.id} className="flex items-center gap-3 py-2.5">
                <Avatar src={person.profilePhoto} name={person.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-ink">
                    {person.name}
                  </span>
                  {person.referredAt ? (
                    <span className="block text-[11.5px] text-ink-subtle">
                      Joined {formatRelative(person.referredAt)}
                    </span>
                  ) : null}
                </span>
                {/* Signed up ≠ joined. Somebody who stopped at the username
                    step is a click, not a member, and any future reward should
                    key off the difference rather than the raw count. */}
                {person.onboarded ? (
                  <span className="shrink-0 rounded-full bg-brand-muted px-2 py-0.5 text-[11px] font-medium text-brand">
                    Joined
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-ink-subtle">
                    Signed up
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 border-t border-line pt-3 text-[11.5px] leading-relaxed text-ink-subtle">
          Attribution is live — we record who joined through your link. There is no
          payout rule yet, so nothing here is owed to anyone.
        </p>
      </section>

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        url={link}
        message={SHARE_MESSAGE}
      />
    </div>
  );
}
