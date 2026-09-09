'use client';

import { use, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, MapPin, Users } from 'lucide-react';

import { formatCountdown } from '@/lib/utils';
import { isSquadLive, purposeIcon, purposeLabel } from '@/lib/squad-purpose';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SquadTabs, type SquadTab } from '@/components/squads/squad-tabs';
import { useSquadPresence } from '@/lib/hooks/use-squad-presence';
import { squadMembersService, squadsService } from '@/lib/services/squads';
import { SquadMembersBoard } from '@/components/squads/squad-members-board';
import { VerificationGate, useVerificationGate } from '@/components/shared/verification-gate';
import { SquadJourneyPanel } from '@/components/squads/squad-journey-panel';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton, SkeletonMap } from '@/components/ui/skeleton';
import { MapCanvas } from '@/components/map/map-canvas';
import { ChatDialog } from '@/components/chat/chat-dialog';
import { JoinFeeDialog, JoinFeeNotice } from '@/components/squads/join-fee-dialog';
import { useEndSquad, useJoinSquad, useLeaveSquad, useSquad, useThreads } from '@/lib/hooks/queries';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-provider';
import { useLivePositions } from '@/lib/live/use-live';
import { rooms } from '@/lib/live/socket';
import type { MapEntity } from '@/lib/map/types';

export default function SquadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { profile } = useAuth();
  const { data: squad, isPending, isError } = useSquad(id);
  const join = useJoinSquad(id);
  const leave = useLeaveSquad(id);
  const endSquad = useEndSquad(id);
  const router = useRouter();
  const [tab, setTab] = useState<SquadTab>('members');
  /** Two-step, because leaving can also transfer leadership. */
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  /** Set when the API rejects a join because the user is committed elsewhere. */
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  // Read as a boolean so the page can decide *where* the gate goes rather than
  // letting it render wherever it happens to be mounted.
  const { verified: instituteVerified, ready: gateReady } = useVerificationGate();

  /**
   * Unread messages in this squad's own thread.
   *
   * Read off the thread list the app already loads and which RealtimeBridge
   * already invalidates on `chat:message` — so the badge moves on the same
   * server count the inbox uses, and a socket event can never make the two
   * disagree. Nothing is tallied client-side.
   */
  const threads = useThreads();
  const squadChatUnread =
    (threads.data ?? []).find(
      (thread) => thread.contextType === 'squad' && thread.contextId === id,
    )?.unreadCount ?? 0;
  /** Which terminal transition the leader is confirming, if any. */
  const [endAction, setEndAction] = useState<'completed' | 'cancelled' | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [feeOpen, setFeeOpen] = useState(false);

  // One room for the whole squad; the server fans member positions into it.
  const livePositions = useLivePositions(useMemo(() => [rooms.squad(id)], [id]));

  /**
   * Both of these sit above the loading and error returns because hooks may
   * not be called conditionally — `enabled` is what actually gates them, not
   * their position in the function.
   *
   * Position reporting runs only for a member of an active squad, and only
   * while this page is open: closing it stops the broadcast, which is what
   * someone would expect from "I am on the squad screen".
   */
  const canShare = Boolean(
    squad?.viewerRole && isSquadLive(squad.status) && squad.can?.shareLocation,
  );
  const presence = useSquadPresence(id, { enabled: canShare });

  const payment = useQuery({
    queryKey: ['squad', id, 'payment'],
    queryFn: () => squadsService.paymentStatus(id),
    enabled: Boolean(squad?.viewerRole),
  });

  const progress = useQuery({
    queryKey: ['squad', id, 'progress'],
    queryFn: () => squadMembersService.progress(id),
    enabled: Boolean(squad?.viewerRole),
    // Each poll costs one walking-Directions call per moving member, so this
    // is deliberately slower than the socket position stream — and it stops
    // once the server refuses, rather than re-asking a forbidden question
    // every 20 seconds. See the note on the same query in SquadMembersBoard.
    refetchInterval: (query) => (query.state.error ? false : 20_000),
  });

  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !squad) {
    return (
      <EmptyState
        tone="error"
        title="Squad not found"
        description="It may be private, or it may have been disbanded."
        action={
          <Link href="/squads">
            <Button size="sm" variant="secondary">
              Back to squads
            </Button>
          </Link>
        }
      />
    );
  }

  const isLeader = squad.viewerRole === 'leader' || squad.leaderId === profile?.id;
  const isMember = Boolean(squad.viewerRole);
  /** Approved but unpaid. The leader is never charged, so this is false for them. */
  const feeDue = Boolean(payment.data?.due && !payment.data.paid);

  /**
   * The viewer's own row from the progress poll. `presence` is the live
   * client-side distance and updates every tick; this carries the server's
   * walking ETA, which needs a Directions call and so refreshes far slower.
   */
  const viewerProgress = progress.data?.items.find((entry) => entry.user.id === profile?.id);

  const entities: MapEntity[] = [];
  if (squad.meetingPoint) {
    entities.push({
      id: `meeting:${squad.id}`,
      layer: 'squads',
      position: [squad.meetingPoint.lng, squad.meetingPoint.lat],
      title: squad.meetingPoint.label ?? 'Meeting point',
      subtitle: squad.meetingAt ? formatCountdown(squad.meetingAt) : null,
      marker: 'meeting',
      live: true,
    });
  }
  if (squad.destination) {
    entities.push({
      id: `destination:${squad.id}`,
      layer: 'squads',
      position: [squad.destination.lng, squad.destination.lat],
      title: squad.destination.label ?? 'Destination',
      marker: 'destination',
    });
  }

  /**
   * Members carry their role into the marker so the map reads without a
   * legend: the leader is crowned, guests are grey. The viewer is skipped —
   * SplitMap already draws them as the blue self puck, and two markers on one
   * person is just clutter.
   */
  for (const entry of progress.data?.items ?? []) {
    if (entry.lat === null || entry.lng === null) continue;
    if (entry.user.id === profile?.id) continue;
    entities.push({
      id: `member:${entry.user.id}`,
      layer: 'friends',
      position: [entry.lng, entry.lat],
      title: entry.user.name,
      subtitle: entry.status === 'arrived' ? 'Arrived' : null,
      marker:
        entry.role === 'leader' ? 'leader' : entry.role === 'guest' ? 'guest' : 'member',
      live: entry.status === 'travelling',
      imageUrl: entry.user.profilePhoto,
    });
  }

  /**
   * The join control, defined once and placed by `gateBlocksJoin` — inline in
   * the header when it is just a button, or inside the gate card below when the
   * account still has to verify.
   *
   * Same gate as a ride, different words: a squad join is a *request* the leader
   * decides on, and only then does the fee apply. The CTA has to promise the
   * step it actually starts.
   */
  const joinButton = (
    <Button
      size="sm"
      loading={join.isPending}
      onClick={() =>
        join.mutate(undefined, {
          onError: (err) => {
            // 409 means they are committed elsewhere — an explainable
            // situation with an action, not a failure to report.
            if (err instanceof ApiError && err.code === 'already-in-squad') {
              setBlockedReason(err.message);
            }
          },
        })
      }
    >
      Request to join
    </Button>
  );

  const awaitingApproval =
    squad.viewerStatus === 'pending' || join.data?.viewerStatus === 'pending';
  /** True only when the gate will render its card instead of the button. */
  const gateBlocksJoin = !isMember && !awaitingApproval && gateReady && !instituteVerified;

  const headerAction = isMember ? (
    <Badge tone="brand">{isLeader ? 'Leader' : 'Member'}</Badge>
  ) : awaitingApproval ? (
    /* Admission is the leader's call, so this is a waiting state, not a
       membership one — offering "Join" again here would suggest the tap
       failed and queue nothing. */
    <Badge tone="neutral">Request sent</Badge>
  ) : gateBlocksJoin ? null : (
    joinButton
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* items-start, not items-center: the heading wraps to two lines on a
          narrow screen and the back arrow should stay level with its first
          line rather than drifting to the middle of the block. */}
      <div className="flex items-start gap-3">
        <Link
          href="/squads"
          aria-label="Back to squads"
          className="rounded-md p-2 text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          {/* Destination headlines here too, so the page matches the card and
              the map marker someone tapped to reach it. */}
          {/* The destination is the headline and is set noticeably larger than
              the supporting line — it is the one thing someone opening this
              page needs to confirm before anything else. */}
          <h1 className="truncate font-display text-[26px] font-bold leading-tight tracking-[-0.03em] text-ink sm:text-[30px]">
            {squad.destination?.label?.split(',')[0] ?? squad.name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-muted">
            {squad.destination ? <span className="truncate">{squad.name}</span> : null}
            <span aria-hidden className="text-ink-subtle">·</span>
            <span className="inline-flex items-center gap-1 font-medium text-ink">
              <Users className="h-3.5 w-3.5" />
              {squad.memberCount}
              {squad.memberLimit ? `/${squad.memberLimit}` : ''}
            </span>
            <span aria-hidden className="text-ink-subtle">·</span>
            {/* Emoji is decorative; the label carries the meaning. */}
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-muted px-2 py-0.5 text-[12px] font-medium text-brand">
              <span aria-hidden>{purposeIcon(squad.type)}</span>
              {purposeLabel(squad.type)}
            </span>
          </div>
        </div>
        {/*
          Only ever a compact control here — a badge or a single button, and
          `shrink-0` so it keeps its size while the title truncates beside it.

          The verification gate used to sit in this slot, and it is not a
          control: it renders a card plus the whole verify-with-Google banner.
          As the third child of a non-wrapping `flex items-center` row it was
          laid out *beside* the title on every width, so on a phone the heading
          and its "1/4 · College" meta were squeezed into the leftover space and
          collided with the card. A block that size belongs in the column, not
          in a header row.
        */}
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </div>

      {/* Full width, in normal flow, below the header — nothing to overlap. */}
      {gateBlocksJoin ? (
        <VerificationGate action="join this squad">{joinButton}</VerificationGate>
      ) : null}

      {/* Members get the journey view; everyone else gets the summary strip,
          because distance and navigation only mean anything once you're in. */}
      {isMember && (squad.meetingPoint || squad.destination) ? (
        <>
          <SquadJourneyPanel
            squad={squad}
            distanceMetres={presence.distanceMetres ?? viewerProgress?.distanceMetres ?? null}
            etaSeconds={viewerProgress?.etaSeconds ?? null}
            arrived={presence.arrived || viewerProgress?.status === 'arrived'}
          />
          {squad.meetingAt ? (
            <div className="flex items-center gap-2.5 rounded-lg bg-accent-muted px-4 py-3">
              <Clock className="h-4 w-4 shrink-0 text-accent" />
              <span className="min-w-0 flex-1 text-[13px] font-medium text-accent">
                Leaving {formatCountdown(squad.meetingAt)}
              </span>
            </div>
          ) : null}
        </>
      ) : squad.meetingPoint ? (
        <div className="flex items-center gap-2.5 rounded-lg bg-accent-muted px-4 py-3">
          <MapPin className="h-4 w-4 shrink-0 text-accent" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-accent">
            {squad.meetingPoint.label ?? 'Meeting point set'}
          </span>
          {squad.meetingAt ? (
            <span className="shrink-0 text-[13px] text-accent">
              {formatCountdown(squad.meetingAt)}
            </span>
          ) : null}
        </div>
      ) : isLeader ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-line px-4 py-3">
          <span className="text-[13px] text-ink-muted">No meeting point yet.</span>
          <Button size="sm" variant="secondary" onClick={() => setTab('map')}>
            Set one
          </Button>
        </div>
      ) : null}

      {/* Chat is not a tab any more — it opens as a dialog, because a
          conversation inside a scrolling page loses its composer as you type. */}
      <SquadTabs
        value={tab}
        onChange={(next) => {
          if (next === 'chat') {
            setChatOpen(true);
            return;
          }
          setTab(next);
        }}
        memberCount={squad.memberCount}
        chatUnread={squadChatUnread}
      />

      {tab === 'members' ? (
        isMember && squad.can ? (
          <div className="space-y-4">
            {/*
              The join code is deliberately not shown here.

              Discovery is the route people actually take: find the squad,
              request, the leader approves. A six-character code printed at the
              top of the members tab implied the normal way in was to type it
              somewhere, which is a step this flow does not have. The code is
              still allocated and still resolves server-side
              (squadsMembers.ts and services/squads.ts both look squads up by
              it), so invite-by-code keeps working wherever it is offered — it
              is only the clutter on this screen that is gone.
            */}
            <SquadMembersBoard squadId={squad.id} can={squad.can} viewerId={profile?.id} />

            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
              {/* The leader's way out. Without this the one-squad-at-a-time
                  rule is a trap: they can neither start another nor join one. */}
              {isLeader && isSquadLive(squad.status) ? (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setEndAction('completed')}
                  >
                    Mark as done
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setEndAction('cancelled')}>
                    Cancel squad
                  </Button>
                </>
              ) : null}

              <button
                type="button"
                onClick={() => setLeaveConfirm(true)}
                className="ml-auto text-[13px] font-medium text-danger transition-opacity hover:opacity-80"
              >
                Leave squad
              </button>
            </div>
          </div>
        ) : (
          /**
           * Compact by construction, not by shrinking a big card.
           *
           * This is a one-line fact — the roster is private until you join —
           * and it was rendering as a tall panel with the text stranded in the
           * middle of a large empty rectangle. Height should come from the
           * content, so this is a single row: icon, statement, explanation.
           *
           * Scoped here rather than changed in EmptyState, which every list in
           * the app shares and which is already compact for its own uses.
           */
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-line px-3.5 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-ink-subtle">
              <Users className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold leading-tight text-ink">
                Members are private
              </p>
              <p className="mt-0.5 text-[12.5px] leading-snug text-ink-muted">
                Join the squad to see who is coming.
              </p>
            </div>
          </div>
        )
      ) : null}

      {/* Location banner. Sharing is what the whole live map depends on, so a
          denied permission is stated plainly rather than showing an empty map.
          The arrived case is not repeated here — the journey panel above
          already says it, next to the distance it replaces. */}
      {isMember && presence.error ? (
        <p className="rounded-lg bg-warning/10 px-4 py-3 text-[13px] leading-relaxed text-ink">
          {presence.error}
        </p>
      ) : null}

      {tab === 'map' ? (
        <div className="h-[min(55dvh,420px)] overflow-hidden rounded-lg border border-line sm:h-[420px]">
          {squad.meetingPoint || livePositions.size > 0 ? (
            <MapCanvas
              mode="focused-squad"
              layers={['squads', 'friends']}
              entities={entities}
              livePositions={livePositions}
              center={
                squad.meetingPoint
                  ? [squad.meetingPoint.lng, squad.meetingPoint.lat]
                  : null
              }
            />
          ) : (
            <SkeletonMap />
          )}
        </div>
      ) : null}

      {tab === 'activity' ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No activity yet"
          description="Joins, meeting-point changes and ride links will appear here."
        />
      ) : null}

      {/* Shown to an approved member who has not paid. The API is the real
          gate — this is the prompt, not the enforcement. */}
      {isMember && feeDue ? <JoinFeeNotice onPay={() => setFeeOpen(true)} /> : null}

      <JoinFeeDialog
        squadId={squad.id}
        squadName={squad.destination?.label?.split(',')[0] ?? squad.name}
        open={feeOpen}
        onClose={() => setFeeOpen(false)}
      />

      <ChatDialog
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        contextType="squad"
        contextId={squad.id}
        title={squad.destination?.label?.split(',')[0] ?? squad.name}
        subtitle={`${squad.memberCount} member${squad.memberCount === 1 ? '' : 's'}`}
      />

      {/* Ending is terminal and releases every member, so it is confirmed with
          the consequences named rather than fired from a bare button. */}
      <ConfirmDialog
        open={endAction !== null}
        onClose={() => setEndAction(null)}
        onConfirm={() =>
          endAction &&
          endSquad.mutate(endAction, { onSuccess: () => router.replace('/squads') })
        }
        eyebrow={endAction === 'cancelled' ? 'Cancel squad' : 'Mark as done'}
        title={squad.destination?.label?.split(',')[0] ?? squad.name}
        description={
          endAction === 'cancelled'
            ? 'Everyone is told the trip is off and released to join another squad. This cannot be undone.'
            : 'The squad closes and everyone is released to join another. This cannot be undone.'
        }
        details={[
          {
            label: `${squad.memberCount} member${squad.memberCount === 1 ? '' : 's'} affected`,
            items: [
              'Live location sharing stops',
              'The group chat closes',
              'Everyone becomes free to join or start another squad',
            ],
          },
        ]}
        confirmLabel={endAction === 'cancelled' ? 'Cancel it' : 'Mark as done'}
        confirmTone={endAction === 'cancelled' ? 'danger' : 'primary'}
        cancelLabel="Keep it running"
        loading={endSquad.isPending}
        error={
          endSquad.isError
            ? endSquad.error instanceof Error
              ? endSquad.error.message
              : "Couldn't update the squad."
            : null
        }
      />

      {/* One squad at a time. Explained rather than reported: the person has a
          clear next step, and it is not "try again". */}
      <ConfirmDialog
        open={Boolean(blockedReason)}
        onClose={() => setBlockedReason(null)}
        onConfirm={() => {
          setBlockedReason(null);
          router.push('/squads');
        }}
        eyebrow="Already in a squad"
        title="You can only be in one squad at a time"
        description={blockedReason ?? ''}
        details={[
          {
            label: 'Why',
            items: [
              'You can only physically travel with one group at a time',
              'Leaders are counting on everyone who joined to actually arrive',
            ],
          },
        ]}
        confirmLabel="Go to my squad"
        cancelLabel="Stay here"
      />

      {/* Leaving is not undoable — rejoining a private squad needs the leader,
          and a leader who leaves hands the squad to someone else. */}
      <ConfirmDialog
        open={leaveConfirm}
        onClose={() => setLeaveConfirm(false)}
        onConfirm={() =>
          leave.mutate(undefined, { onSuccess: () => router.replace('/squads') })
        }
        eyebrow="Leave squad"
        title={squad.destination?.label?.split(',')[0] ?? squad.name}
        description={
          isLeader
            ? 'You lead this squad. Leaving hands it to another member.'
            : 'You will stop sharing your location and lose access to the squad chat.'
        }
        details={[
          {
            label: 'You will lose',
            items: [
              'Squad chat and files',
              'Live location and everyone’s ETA',
              ...(squad.meetingPoint
                ? [`Directions to ${squad.meetingPoint.label?.split(',')[0] ?? 'the meeting point'}`]
                : []),
            ],
          },
        ]}
        secondaryDetails={
          isLeader
            ? [
                {
                  label: 'Handover',
                  items: [
                    'The longest-standing member becomes leader',
                    'They can move the meeting point and admit members',
                  ],
                },
              ]
            : undefined
        }
        confirmLabel="Leave squad"
        confirmTone="danger"
        loading={leave.isPending}
        error={
          leave.isError
            ? leave.error instanceof Error
              ? leave.error.message
              : "Couldn't leave the squad."
            : null
        }
      />
    </div>
  );
}
