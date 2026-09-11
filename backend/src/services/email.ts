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
 * Two messages exist and no more: a leader is told somebody asked to join, and
 * an asker is told they were let in. Every additional type is another way to
 * end up in spam, so the list grows only when a push notification genuinely
 * cannot serve instead. See docs/EMAIL-SYSTEM.md.
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
   * Stable per (event, recipient) so a retry cannot send twice. Resend honours
   * this for 24h, which is longer than any retry window here.
   */
  idempotencyKey: string;
}

/**
 * One layout for both messages.
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
    <a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;background:#00c853;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:999px;">${escapeHtml(input.actionLabel)}</a>
    <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#7b817c;">
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
 * Tells a leader that somebody has asked to join.
 *
 * The link goes to the squad page, not to an accept action — accepting from a
 * link is Phase 3, and doing it before the token design is reviewed would mean
 * a URL that admits a stranger to a live-location group. See
 * docs/EMAIL-SYSTEM.md.
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

  const sent = await send({
    to: to.email,
    subject: `${params.requesterName} wants to join ${params.squadName}`,
    heading: 'Someone wants to join your squad',
    body: `${params.requesterName} has asked to join ${params.squadName}. Open the squad to see who they are and decide.`,
    actionLabel: 'Review the request',
    /**
     * The token is in the path, not a query string. Query strings travel in the
     * `Referer` header to anything the destination page loads, and this one
     * names a pending decision.
     *
     * The link only opens the request; it authorises nothing. The page requires
     * a session and the decision is a POST — see services/joinRequestTokens.ts
     * for why a GET here would be answered by a mail scanner.
     */
    actionUrl: params.token
      ? `${cfg.appUrl}/squads/${params.squadId}/requests/${params.token}`
      : `${cfg.appUrl}/squads/${params.squadId}`,
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

/** Tells someone their request was accepted. */
export async function emailRequestAccepted(params: {
  userId: string;
  squadId: string;
  squadName: string;
}): Promise<void> {
  const cfg = config();
  if (!cfg) return;

  const to = await recipientFor(params.userId, EMAIL_CATEGORIES.REQUEST_ACCEPTED, params.squadId);
  if (!to) return;

  const sent = await send({
    to: to.email,
    subject: `You're in — ${params.squadName}`,
    heading: `You're in`,
    body: `Your request to join ${params.squadName} was accepted. Open the squad to see the meeting point and who else is going.`,
    actionLabel: 'Open the squad',
    actionUrl: `${cfg.appUrl}/squads/${params.squadId}`,
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
  }
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
