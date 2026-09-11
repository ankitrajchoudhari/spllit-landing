import prisma from '../utils/prisma.js';
import {
  EMAIL_CATEGORIES,
  mayEmail,
  recordEmailSent,
  type EmailCategory,
} from './emailPolicy.js';

/**
 * Transactional email, over Resend.
 *
 * The list is short on purpose — every additional type is another way to end up
 * in spam, so it grows only when a push notification genuinely cannot serve
 * instead. What is here: a leader is told somebody asked to join, an asker is
 * told they were let in, a creator gets a receipt for the squad or ride they
 * just made, and an account is welcomed once. See docs/EMAIL-SYSTEM.md.
 *
 * Explicitly *not* services/emailService.ts, which sends CSV campaigns through
 * a Gmail or Zoho mailbox. Transactional mail needs delivery webhooks, a
 * suppression list, and a sending reputation that is not shared with marketing.
 *
 * ## Three rules this module will not break
 *
 * 1. **It never fails the action.** A join request must not fail because mail
 *    failed. Every path here swallows its own errors, the same rule the
 *    analytics `observe()` hook in utils/prisma.ts follows: the user's write
 *    has already committed and a delivery problem cannot undo it.
 * 2. **It never sends to an unverified address.** An address nobody proved they
 *    own is how a domain collects hard bounces, and hard bounces are what get a
 *    sender blocked.
 * 3. **Nothing exists only in an email.** The in-app notification is the source
 *    of truth; this is a copy that may or may not arrive.
 *
 * Plain `fetch` rather than the SDK — one POST against a stable REST API, versus
 * a dependency and its transitive tree in a service that builds from source on
 * every push.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/** Absent key disables sending entirely, quietly. */
function config() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;

  return {
    apiKey,
    from: process.env.EMAIL_FROM?.trim() || 'Spllit <notifications@mail.spllit.app>',
    replyTo: process.env.EMAIL_REPLY_TO?.trim() || 'support@spllit.app',
    appUrl: (process.env.APP_URL?.trim() || 'https://spllit.app').replace(/\/$/, ''),
  };
}

export function isEmailConfigured(): boolean {
  return config() !== null;
}

/** Minimal escaping for the few values interpolated into the HTML below. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface SendInput {
  to: string;
  subject: string;
  heading: string;
  body: string;
  actionLabel: string;
  actionUrl: string;
  /**
   * An optional second choice, shown beside the first.
   *
   * Only for messages that genuinely present two answers — the join request
   * being the one. Both are ordinary links to the same decision page; neither
   * decides anything on its own. See `emailJoinRequested` for why that
   * separation is not negotiable.
   */
  secondaryLabel?: string;
  secondaryUrl?: string;
  /**
   * Stable per (event, recipient) so a retry cannot send twice. Resend honours
   * this for 24h, which is longer than any retry window here.
   */
  idempotencyKey: string;
}

/**
 * One layout for every message.
 *
 * Deliberately plain: a table-free single column, system fonts, no images. The
 * elaborate version renders differently in every client and buys nothing for a
 * message whose entire job is one sentence and one link. No tracking pixel —
 * open tracking is what makes a transactional message look like marketing to a
 * spam filter, and Spllit does not need to know when a leader read this.
 */
function render(input: SendInput, appUrl: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#eaece7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px;">
    <p style="margin:0 0 20px;font-size:18px;font-weight:600;color:#101211;">Spllit</p>
    <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#101211;">${escapeHtml(input.heading)}</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4e544f;">${escapeHtml(input.body)}</p>
    <a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;background:#00c853;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:999px;">${escapeHtml(input.actionLabel)}</a>${
      input.secondaryLabel && input.secondaryUrl
        ? `
    <a href="${escapeHtml(input.secondaryUrl)}" style="display:inline-block;margin-left:8px;background:#ffffff;color:#4e544f;text-decoration:none;font-size:15px;font-weight:600;padding:11px 21px;border:1px solid #d7dad6;border-radius:999px;">${escapeHtml(input.secondaryLabel)}</a>`
        : ''
    }
    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#4e544f;">
      Or <a href="${escapeHtml(appUrl)}" style="color:#0a7d34;font-weight:600;">open the Spllit web app</a>.
    </p>
    <p style="margin:12px 0 0;font-size:12px;line-height:1.6;color:#7b817c;">
      You are receiving this because you use Spllit.
      <a href="${escapeHtml(appUrl)}/settings/notifications" style="color:#7b817c;">Manage notifications</a>.
    </p>
  </div>
</body></html>`;
}

/** Plain-text alternative. A message with no text part scores worse in filters. */
function renderText(input: SendInput, appUrl: string): string {
  return [
    input.heading,
    '',
    input.body,
    '',
    `${input.actionLabel}: ${input.actionUrl}`,
    ...(input.secondaryLabel && input.secondaryUrl
      ? [`${input.secondaryLabel}: ${input.secondaryUrl}`]
      : []),
    '',
    `Open the Spllit web app: ${appUrl}`,
    '',
    `Manage notifications: ${appUrl}/settings/notifications`,
  ].join('\n');
}

async function send(input: SendInput): Promise<boolean> {
  const cfg = config();
  if (!cfg) return false;

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({
        from: cfg.from,
        to: [input.to],
        reply_to: cfg.replyTo,
        subject: input.subject,
        html: render(input, cfg.appUrl),
        text: renderText(input, cfg.appUrl),
        headers: {
          /**
           * Required by Gmail and Yahoo of bulk senders since February 2024,
           * and not only for marketing. A missing List-Unsubscribe is a direct
           * route to the spam folder.
           *
           * Both forms: the mailto works everywhere, and the POST form is what
           * makes the client's own one-click button appear. Phase 4 replaces
           * the URL with a real no-session unsubscribe endpoint.
           */
          'List-Unsubscribe': `<mailto:${cfg.replyTo}?subject=unsubscribe>, <${cfg.appUrl}/settings/notifications>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
      // A hung mail API must not hold a request open.
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error(`[email] Resend refused (${response.status}): ${detail.slice(0, 300)}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[email] send failed', error);
    return false;
  }
}

/**
 * Resolves a recipient, or explains why there will not be one.
 *
 * Every rule lives in services/emailPolicy.ts — verified address, suppression
 * list, the person's own preferences, quiet hours, the per-squad cool-off and
 * the hourly cap. Keeping the decision in one module is what stops the newest
 * message type being the one that forgot the suppression check.
 *
 * Returns null rather than throwing: every caller sits on a path where the real
 * work has already committed.
 */
async function recipientFor(
  userId: string,
  category: EmailCategory,
  scopeId?: string,
): Promise<{ email: string; name: string } | null> {
  try {
    const verdict = await mayEmail({ userId, category, scopeId });
    if (!verdict.allowed) {
      console.log(`[email] not sending ${category}: ${verdict.reason}`);
      return null;
    }
    return { email: verdict.email!, name: verdict.name! };
  } catch (error) {
    console.error('[email] policy check failed', error);
    return null;
  }
}

/**
 * Tells a leader that somebody has asked to join, and offers both answers.
 *
 * ## Two buttons, neither of which decides anything
 *
 * "Add to squad" and "Decline" are both ordinary links to the same decision
 * page, differing only in a `#fragment` that tells the page which button to
 * put forward. That indirection is the entire safety property and it is not
 * decoration:
 *
 *   - **A fragment never leaves the browser.** It is not in the request line
 *     and not in `Referer`, so the choice cannot leak to anything the page
 *     loads — and, more importantly, a scanner fetching the URL sends the
 *     server no opinion at all.
 *   - **Mail is read by machines first.** Outlook Safe Links, Gmail's proxy and
 *     corporate antivirus all fetch URLs found in mail before a person sees
 *     them. A link that admitted somebody on GET would admit them minutes after
 *     sending, to a group sharing live location, with the leader never having
 *     opened the message.
 *
 * So the page still requires a session and still makes the leader press the
 * button; the email just means they arrive with the right one under the cursor.
 * See services/joinRequestTokens.ts and docs/EMAIL-SYSTEM.md.
 */
export async function emailJoinRequested(params: {
  leaderId: string;
  squadId: string;
  squadName: string;
  requesterName: string;
  /**
   * Opens the request directly. Omitted, the link falls back to the squad page
   * — the email still works, it just costs the leader a click to find the
   * request. Minting a token must never be able to stop the mail going out.
   */
  token?: string;
}): Promise<void> {
  const cfg = config();
  if (!cfg) return;

  const to = await recipientFor(params.leaderId, EMAIL_CATEGORIES.JOIN_REQUEST, params.squadId);
  if (!to) return;

  /**
   * The token is in the path, not a query string. Query strings travel in the
   * `Referer` header to anything the destination page loads, and this one names
   * a pending decision.
   *
   * Without a token there is nothing specific to open, so both buttons collapse
   * to the squad page and the leader decides there. Minting a token must never
   * be able to stop the mail going out.
   */
  const base = params.token
    ? `${cfg.appUrl}/squads/${params.squadId}/requests/${params.token}`
    : `${cfg.appUrl}/squads/${params.squadId}`;

  const sent = await send({
    to: to.email,
    subject: `${params.requesterName} wants to join ${params.squadName}`,
    heading: 'Someone wants to join your squad',
    body: `${params.requesterName} has asked to join ${params.squadName}. Choose below and we will take you there to confirm.`,
    actionLabel: 'Add to squad',
    actionUrl: params.token ? `${base}#approve` : base,
    secondaryLabel: 'Decline',
    secondaryUrl: params.token ? `${base}#decline` : base,
    // One request produces one email to one leader, however many times the
    // notification path runs.
    idempotencyKey: `join-requested:${params.squadId}:${params.requesterName}:${params.leaderId}`,
  });

  // Only a send that actually happened starts the cool-off. Logging a failure
  // would let a broken provider silence this squad for half an hour.
  if (sent) {
    await recordEmailSent({
      userId: params.leaderId,
      category: EMAIL_CATEGORIES.JOIN_REQUEST,
      scopeId: params.squadId,
    });
  }
}

/**
 * Tells someone their request was accepted, and by whom.
 *
 * The leader is named because "your request was accepted" reads as machinery
 * and "Ankit added you" reads as a person letting you in — which is what
 * actually happened, and which of the two a stranger about to share a cab with
 * them would rather receive.
 *
 * Resolved here from an id rather than passed in as a string, so the two call
 * sites that approve a request — the in-app one and the one behind the emailed
 * link — cannot drift, and neither can forget.
 *
 * Note it is whoever *decided*, not the squad's leader. Admission is gated on
 * `can.admitMembers`, which a co-leader also has, so naming the leader would
 * credit the wrong person on every request a co-leader answers.
 */
export async function emailRequestAccepted(params: {
  userId: string;
  squadId: string;
  squadName: string;
  decidedById?: string;
}): Promise<void> {
  const cfg = config();
  if (!cfg) return;

  const to = await recipientFor(params.userId, EMAIL_CATEGORIES.REQUEST_ACCEPTED, params.squadId);
  if (!to) return;

  /**
   * A missing name is not a reason to withhold the message, so every failure
   * here falls back to the impersonal wording rather than returning.
   */
  let deciderName: string | null = null;
  if (params.decidedById) {
    try {
      const decider = await prisma.user.findUnique({
        where: { id: params.decidedById },
        select: { name: true },
      });
      deciderName = decider?.name?.trim() || null;
    } catch {
      deciderName = null;
    }
  }

  const sent = await send({
    to: to.email,
    subject: deciderName
      ? `${deciderName} added you to ${params.squadName}`
      : `You're in — ${params.squadName}`,
    heading: `You're in`,
    body: deciderName
      ? `${deciderName} accepted your request to join ${params.squadName}. Open the squad to see the meeting point and who else is going.`
      : `Your request to join ${params.squadName} was accepted. Open the squad to see the meeting point and who else is going.`,
    actionLabel: 'Open the squad',
    actionUrl: `${cfg.appUrl}/squads/${params.squadId}`,
    // Two destinations, not one repeated: the squad they just joined, and
    // everything else they have going on.
    secondaryLabel: 'Open Spllit',
    secondaryUrl: cfg.appUrl,
    idempotencyKey: `request-accepted:${params.squadId}:${params.userId}`,
  });

  if (sent) {
    await recordEmailSent({
      userId: params.userId,
      category: EMAIL_CATEGORIES.REQUEST_ACCEPTED,
      scopeId: params.squadId,
    });
  }
}

/**
 * A departure time as a person would say it, in India.
 *
 * Hard-coded to Asia/Kolkata rather than the recipient's stored timezone,
 * because the time being described is a physical meeting on a campus in India —
 * it does not move when the reader is abroad. A student on exchange reading
 * "7:30 pm" wants the time their friends will be standing there, not 2pm their
 * own time.
 */
function formatWhen(at?: Date | null): string | null {
  if (!at || Number.isNaN(at.getTime())) return null;
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(at);
  } catch {
    // A formatting failure must not cost the whole email.
    return null;
  }
}

/**
 * Confirms to somebody that the thing they just made exists.
 *
 * A receipt, not an announcement: it goes to the creator and nobody else, and
 * it carries the join code because that is the one piece of information they
 * cannot reconstruct from memory and will want to paste into a group chat five
 * minutes later.
 *
 * Idempotent on the squad or ride id alone. Creation happens once, so a second
 * send for the same id can only be a retry of the same event — never a new one
 * worth telling somebody about.
 */
export async function emailTripCreated(params: {
  userId: string;
  /** Which surface made it. Changes the wording and the link, nothing else. */
  kind: 'squad' | 'ride';
  id: string;
  /** Squad name, or "Origin → Destination" for a ride. */
  title: string;
  /** Squads only, and only when there is one. */
  joinCode?: string | null;
  /** Meeting or departure time. Formatted here so both callers agree. */
  whenAt?: Date | null;
}): Promise<void> {
  const cfg = config();
  if (!cfg) return;

  const to = await recipientFor(params.userId, EMAIL_CATEGORIES.TRIP_CREATED, params.id);
  if (!to) return;

  const isSquad = params.kind === 'squad';
  const noun = isSquad ? 'squad' : 'ride';

  /**
   * Assembled as sentences rather than one template string with holes in it:
   * a ride has no join code and a squad may have no time set, and a body
   * reading "Share the code  with anyone" is the kind of thing that ships.
   */
  const lines = [
    isSquad
      ? `${params.title} is live. People at your college can find it now, and you will get an email when somebody asks to join.`
      : `${params.title} is posted. You will get an email when somebody asks for a seat.`,
  ];
  const whenLabel = formatWhen(params.whenAt);
  if (whenLabel) lines.push(`Leaving ${whenLabel}.`);
  if (isSquad && params.joinCode) {
    lines.push(`Join code: ${params.joinCode} — share it to pull someone in directly.`);
  }

  const sent = await send({
    to: to.email,
    subject: isSquad ? `Your squad is live — ${params.title}` : `Your ride is posted — ${params.title}`,
    heading: `Your ${noun} is live`,
    body: lines.join(' '),
    actionLabel: isSquad ? 'Open the squad' : 'Open the ride',
    actionUrl: `${cfg.appUrl}/${isSquad ? 'squads' : 'rides'}/${params.id}`,
    idempotencyKey: `trip-created:${params.kind}:${params.id}`,
  });

  if (sent) {
    await recordEmailSent({
      userId: params.userId,
      category: EMAIL_CATEGORIES.TRIP_CREATED,
      scopeId: params.id,
    });
  }
}

/**
 * Tells a ride's host that somebody wants a seat.
 *
 * Deliberately has **one** button where the squad equivalent has two. Rides
 * have no accept-or-decline decision anywhere in the product — the in-app
 * routes for it are deprecated and no screen offers it — so a "Decline" button
 * here would be a link to a thing that cannot be done. It opens the ride, which
 * is where the host can see who asked.
 */
export async function emailRideJoinRequested(params: {
  hostId: string;
  rideId: string;
  rideLabel: string;
  requesterName: string;
}): Promise<void> {
  const cfg = config();
  if (!cfg) return;

  const to = await recipientFor(params.hostId, EMAIL_CATEGORIES.JOIN_REQUEST, params.rideId);
  if (!to) return;

  const sent = await send({
    to: to.email,
    subject: `${params.requesterName} wants a seat — ${params.rideLabel}`,
    heading: 'Someone wants a seat on your ride',
    body: `${params.requesterName} has asked to join ${params.rideLabel}. Open the ride to see who they are.`,
    actionLabel: 'Open the ride',
    actionUrl: `${cfg.appUrl}/rides/${params.rideId}`,
    idempotencyKey: `ride-join-requested:${params.rideId}:${params.requesterName}:${params.hostId}`,
  });

  if (sent) {
    await recordEmailSent({
      userId: params.hostId,
      category: EMAIL_CATEGORIES.JOIN_REQUEST,
      scopeId: params.rideId,
    });
  }
}

/**
 * Welcomes a new account, exactly once.
 *
 * Once is the whole requirement. The obvious hook — "they signed in with an
 * email address" — fires on every sign-in, and a welcome message that arrives
 * weekly reads as a broken system rather than a friendly one. The caller ties
 * this to account *creation*, and the idempotency key is the user id so a retry
 * of that same creation cannot produce a second one either.
 */
export async function emailWelcome(params: { userId: string }): Promise<void> {
  const cfg = config();
  if (!cfg) return;

  /**
   * Claim the welcome before sending it.
   *
   * The guard is `welcomedAt: null` inside the update, so of two callers
   * arriving together exactly one wins — the signup path and the
   * verification-retry path below can genuinely race. Claiming first means the
   * loser sends nothing, where a read-then-write check would have both send.
   *
   * The cost of claiming first is that a failed send leaves the flag set and
   * the person never welcomed. That is the right way round: a missing welcome
   * is a non-event, and a duplicate is the thing that reads as broken.
   */
  const { count } = await prisma.user.updateMany({
    where: { id: params.userId, welcomedAt: null },
    data: { welcomedAt: new Date() },
  });
  if (count !== 1) return;

  const to = await recipientFor(params.userId, EMAIL_CATEGORIES.WELCOME);
  if (!to) {
    // Refused — unverified, suppressed, or switched off. Release the claim so a
    // later verification can still trigger it; otherwise an email/password user
    // who verifies next week would be marked welcomed having received nothing.
    await prisma.user.updateMany({
      where: { id: params.userId, welcomedAt: { not: null } },
      data: { welcomedAt: null },
    });
    return;
  }

  const first = to.name?.trim().split(/\s+/)[0] || 'there';

  const sent = await send({
    to: to.email,
    subject: 'Welcome to Spllit',
    heading: `Welcome, ${first}`,
    body: 'Spllit is how students travelling the same way find each other. Post a ride, start a squad, or see what is already heading where you are going.',
    actionLabel: 'Open Spllit',
    actionUrl: cfg.appUrl,
    // The user id, so this message can only ever exist once per account.
    idempotencyKey: `welcome:${params.userId}`,
  });

  if (sent) {
    await recordEmailSent({ userId: params.userId, category: EMAIL_CATEGORIES.WELCOME });
    return;
  }

  /**
   * The provider refused. Release the claim so the next visit tries again.
   *
   * This used to keep the flag, on the reasoning that a missing welcome is a
   * non-event and a duplicate is what reads as broken. That was defensible when
   * the welcome had one chance anyway — but once the bootstrap path started
   * retrying whenever `welcomedAt` is null, keeping it here made the two
   * failure modes disagree: a quiet-hours refusal healed itself and a
   * five-second Resend outage lost the message permanently. The transient one
   * should not be the unrecoverable one.
   *
   * Safe against duplicates because the idempotency key above is the user id:
   * Resend honours it for 24 hours, so a retry inside that window cannot
   * produce a second message even if this send did in fact arrive and only the
   * response was lost.
   */
  await prisma.user.updateMany({
    where: { id: params.userId, welcomedAt: { not: null } },
    data: { welcomedAt: null },
  });
}

/**
 * Sends a probe message, for confirming the sending domain actually works.
 *
 * Restricted to addresses that already exist as a *verified* user. The
 * maintenance key gates the endpoint, but a key is a thing that can leak, and
 * an endpoint that mails arbitrary strings on request is an open relay wearing
 * a lanyard — precisely the shape spam filters are built to find, on the domain
 * whose reputation this whole exercise exists to protect.
 *
 * Returns why it declined rather than a bare false, because "nothing happened"
 * is the least useful answer when you are trying to establish whether mail
 * works at all.
 */
export async function sendTestEmail(
  to: string,
): Promise<{ sent: boolean; reason?: string }> {
  const cfg = config();
  if (!cfg) return { sent: false, reason: 'RESEND_API_KEY is not set on this service' };

  const address = to.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email: address },
    select: { emailVerified: true },
  });

  if (!user) return { sent: false, reason: 'No Spllit user has that address' };
  if (!user.emailVerified) return { sent: false, reason: 'That address is not verified' };

  // The suppression list is not advisory. An address that bounced or reported
  // spam must not receive a test message either — that is precisely the send
  // that would confirm to a provider we are not listening.
  const suppressed = await prisma.emailSuppression.findUnique({
    where: { email: address },
    select: { reason: true },
  });
  if (suppressed) {
    return { sent: false, reason: `That address is suppressed (${suppressed.reason})` };
  }

  const ok = await send({
    to: address,
    subject: 'Spllit email is working',
    heading: 'Email is working',
    body: 'This is a test from the Spllit backend. If it reached your inbox rather than spam, the sending domain is set up correctly.',
    actionLabel: 'Open Spllit',
    actionUrl: cfg.appUrl,
    // Time-based: a test you cannot repeat is not much of a test, and Resend
    // would silently drop the second one under a fixed key.
    idempotencyKey: `email-test:${address}:${Date.now()}`,
  });

  return ok ? { sent: true } : { sent: false, reason: 'Resend refused the message — see logs' };
}

/**
 * Whether a campaign may be sent at all.
 *
 * Campaigns require their own From address, and are refused without one. The
 * subdomain split exists because sending reputation is per-domain: an
 * announcement is by far the likeliest message to be reported as spam — it is
 * unsolicited by definition, however welcome — and a complaint against it must
 * not be able to stop "your request was accepted" arriving.
 *
 * Defaulting to the transactional sender would be the convenient choice and the
 * wrong one: the damage is invisible for weeks and then permanent.
 */
export function campaignSenderConfigured(): boolean {
  return Boolean(config() && process.env.CAMPAIGN_EMAIL_FROM?.trim());
}

/**
 * Sends one announcement to up to a hundred people.
 *
 * Resend's batch endpoint, one request per batch rather than one per person:
 * a hundred sequential POSTs is a hundred chances to be rate-limited halfway
 * through a broadcast with no record of where it stopped.
 *
 * Every recipient gets their own message — `to` is a single address per entry —
 * so nobody sees anybody else's address. A campaign sent with a shared To or CC
 * is a data breach rather than a mistake.
 */
export async function sendCampaignMessage(params: {
  campaignId: string;
  subject: string;
  body: string;
  recipients: { email: string; name: string }[];
}): Promise<boolean> {
  const cfg = config();
  const from = process.env.CAMPAIGN_EMAIL_FROM?.trim();
  if (!cfg || !from || params.recipients.length === 0) return false;

  const unsubscribe = `${cfg.appUrl}/settings/notifications`;

  const payload = params.recipients.map((person) => ({
    from,
    to: [person.email],
    reply_to: cfg.replyTo,
    subject: params.subject,
    html: render(
      {
        to: person.email,
        subject: params.subject,
        heading: params.subject,
        body: params.body,
        actionLabel: 'Open Spllit',
        actionUrl: cfg.appUrl,
        idempotencyKey: '',
      },
      cfg.appUrl,
    ),
    text: renderText(
      {
        to: person.email,
        subject: params.subject,
        heading: params.subject,
        body: params.body,
        actionLabel: 'Open Spllit',
        actionUrl: cfg.appUrl,
        idempotencyKey: '',
      },
      cfg.appUrl,
    ),
    headers: {
      // Required of bulk senders by Gmail and Yahoo, and this is the message
      // type the requirement was written for.
      'List-Unsubscribe': `<mailto:${cfg.replyTo}?subject=unsubscribe>, <${unsubscribe}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  }));

  try {
    const response = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
        // Per batch, so a retry of the same batch cannot double-send it.
        'Idempotency-Key': `campaign:${params.campaignId}:${params.recipients[0]?.email ?? '0'}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error(`[campaign] Resend refused (${response.status}): ${detail.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[campaign] batch send failed', error);
    return false;
  }
}
