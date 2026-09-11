'use client';

import Link from 'next/link';
import { Bell, Car, LogOut, Star, Users } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkeletonProfile, SkeletonList } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { SquadCard } from '@/components/shared/entity-cards';
import { LeaderboardCard } from '@/components/profile/leaderboard-card';
import { VerifyInstituteBanner, VerifiedChip } from '@/components/shared/verify-institute';
import { useAuth } from '@/lib/auth/auth-provider';
import { useMySquads, useUser } from '@/lib/hooks/queries';
import type { User } from '@/types';

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex-1 rounded-lg border border-line bg-surface px-4 py-3 text-center">
      <div className="mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-surface-sunken text-ink-subtle">
        {icon}
      </div>
      <p className="font-display text-[17px] font-semibold text-ink">{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-[0.05em] text-ink-subtle">{label}</p>
    </div>
  );
}

/**
 * Shared profile surface. `/profile` renders the owner view (editable, sign
 * out); `/profile/[userId]` renders the public read-only view.
 */
export function ProfileView({ userId }: { userId?: string }) {
  const { profile: me, signOut } = useAuth();
  const other = useUser(userId ?? null);

  const isOwner = !userId || userId === me?.id;
  const user: User | null | undefined = isOwner ? me : other.data;
  const isPending = isOwner ? !me : other.isPending;

  const squads = useMySquads();

  if (isPending) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <SkeletonProfile />
        <SkeletonList count={2} />
      </div>
    );
  }

  if (!user) {
    return (
      <EmptyState
        tone="error"
        title="Profile not found"
        description="This account may have been removed."
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start gap-5">
        <Avatar src={user.profilePhoto} name={user.name} size="xl" />
        <div className="min-w-0 flex-1 pt-1">
          <h1 className="truncate font-display text-[24px] font-semibold tracking-[-0.03em] text-ink">
            {user.name}
          </h1>
          {user.username ? (
            <p className="truncate text-[13.5px] text-ink-muted">@{user.username}</p>
          ) : null}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <Badge>{user.college}</Badge>
            {user.homeCity ? <Badge>{user.homeCity}</Badge> : null}
            <VerifiedChip verified={user.instituteVerified} />
          </div>
        </div>
      </div>

      {user.bio ? (
        <p className="text-[14.5px] leading-relaxed text-ink-muted">{user.bio}</p>
      ) : null}

      <div className="flex gap-3">
        <Stat
          label="Rating"
          value={user.rating > 0 ? user.rating.toFixed(1) : '—'}
          icon={<Star className="h-3.5 w-3.5" />}
        />
        <Stat
          label="Rides"
          value={String(user.totalRides)}
          icon={<Car className="h-3.5 w-3.5" />}
        />
        <Stat
          label="Squads"
          value={isOwner ? String(squads.data?.length ?? 0) : '—'}
          icon={<Users className="h-3.5 w-3.5" />}
        />
      </div>

      {isOwner ? (
        <>
          {/* Self-hides once verified, so this costs a verified user nothing. */}
          <VerifyInstituteBanner />

          {/* Owner only: the standings are about where *you* sit, which means
              nothing on somebody else's profile. */}
          <LeaderboardCard />

          <div className="space-y-3">
            <h2 className="font-display text-[15px] font-semibold text-ink">Your squads</h2>
            {squads.isPending ? (
              <SkeletonList count={2} />
            ) : (squads.data ?? []).length === 0 ? (
              <EmptyState
                icon={<Users className="h-5 w-5" />}
                title="Not in a squad yet"
                action={
                  <Link href="/squads">
                    <Button size="sm" variant="secondary">
                      Find one
                    </Button>
                  </Link>
                }
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {(squads.data ?? []).map((squad) => (
                  <SquadCard key={squad.id} squad={squad} />
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-line pt-5">
            {/* The only route into settings today, and what the "Manage
                notifications" link in every email points at — so it has to be
                reachable from inside the app as well, or the email would be the
                only way to find it. */}
            <Link href="/settings/notifications">
              <Button variant="ghost">
                <Bell className="h-4 w-4" />
                Notifications
              </Button>
            </Link>
            <Button variant="ghost" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
