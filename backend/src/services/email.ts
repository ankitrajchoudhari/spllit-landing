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

/** Careers correspondence is routed away from the general support queue. */
const CAREERS_EMAIL = 'career@spllit.app';

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
  /**
   * The recipient's name, for the greeting.
   *
   * Optional because a name is not guaranteed — an account can reach here with
   * an address and nothing else — and a message that says "Hi ," is worse than
   * one that opens with the heading. `greeting()` decides.
   */
  name?: string;
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
   * The facts, as labelled rows rather than buried in the sentence.
   *
   * This is what stops every message looking like the same template with the
   * words swapped: a join code, a departure time and a meeting point are things
   * people come back to the email to *look up*, and a reader scanning for one
   * of them should not have to re-read a paragraph to find it.
   */
  details?: { label: string; value: string }[];
  /**
   * The inbox preview line, shown next to the subject before anything is
   * opened. Left unset it falls back to the body, which is better than the
   * alternative — without a preheader at all, clients scrape whatever markup
   * comes first and show "Spllit Hi Ankit," to every recipient.
   */
  preheader?: string;
  /**
   * Overrides the global reply-to for this one message.
   *
   * Almost nothing should use this — a reply to a ride notification belongs
   * with support like everything else. Careers is the exception: a reply to an
   * application confirmation is about a job, and routing it into the general
   * support queue buries it among people who cannot act on it.
   */
  replyTo?: string;
  /**
   * Stable per (event, recipient) so a retry cannot send twice. Resend honours
   * this for 24h, which is longer than any retry window here.
   */
  idempotencyKey: string;
}

/**
 * "Hi Ankit," — or nothing at all.
 *
 * First name only. Stored names run to three and four words, and "Hi Ankit Raj
 * Choudhari," reads like a bank rather than the app four of your friends use.
 *
 * Returns empty for a missing or unusable name rather than falling back to
 * "Hi there" — a generic greeting is the tell of a bulk send, and the heading
 * underneath already says what happened. Anything that looks like an address is
 * refused too, because accounts created from a phone number can carry one, and
 * "Hi ankit@gmail.com," is worse than no greeting at all.
 */
function greeting(name?: string): string {
  const first = (name ?? '').trim().split(/\s+/)[0] ?? '';
  if (first.length < 2 || first.length > 24) return '';
  if (first.includes('@') || /\d{3}/.test(first)) return '';
  return first;
}

/**
 * One layout, every message.
 *
 * Still deliberately restrained — no imagery, no tracking pixel, system fonts.
 * Open tracking is what makes a transactional message look like marketing to a
 * spam filter, and Spllit has no reason to know when a leader read this.
 *
 * What it is not is plain. Four things here are the difference between mail
 * that reads as machinery and mail that reads as a product:
 *
 * ## 1. Tables, because Outlook is not a browser
 *
 * Outlook on Windows renders with Word's engine, which ignores padding on
 * inline elements and has no reliable box model. A `<div>` centred with
 * `margin:0 auto` drifts left and a padded `<a>` button collapses to a bare
 * link. Every structural element below is a table for that reason alone.
 *
 * ## 2. A preheader
 *
 * The grey line the inbox shows beside the subject. Without one, clients scrape
 * whatever markup comes first — so every message previewed as "Spllit Hi
 * Ankit,", spending the one line of copy that decides whether it gets opened.
 * It is hidden in the body by the usual belt-and-braces of zero size, zero
 * opacity and off-screen positioning, because no single trick works everywhere.
 *
 * ## 3. Facts as rows, not prose
 *
 * A join code, a departure time, a meeting point are things people reopen the
 * email to look up. In a paragraph they have to re-read a sentence to find one;
 * as labelled rows they find it without reading. It is also what stops seven
 * message types looking like one template with the nouns swapped.
 *
 * ## 4. Dark mode
 *
 * Apple Mail and iOS honour `prefers-color-scheme`; clients that do not simply
 * keep the light palette, since every colour is also set inline. Without it, a
 * white card is inverted by the client into something muddy and unreadable —
 * worse than either deliberate scheme.
 */
function render(input: SendInput, appUrl: string): string {
  const hi = greeting(input.name);
  const preheader = input.preheader ?? input.body;

  const button = (label: string, url: string, primary: boolean) => `
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-block;">
                    <tr>
                      <td align="center" bgcolor="${primary ? '#00c853' : '#ffffff'}" style="border-radius:999px;${
                        primary ? '' : 'border:1px solid #d7dad6;'
                      }">
                        <a href="${escapeHtml(url)}" style="display:inline-block;padding:${
                          primary ? '13px 26px' : '12px 25px'
                        };font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;line-height:1;color:${
                          primary ? '#ffffff' : '#4e544f'
                        };text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
                      </td>
                    </tr>
                  </table>`;

  const detailRows = (input.details ?? [])
    .filter((row) => row.value && row.value.trim().length > 0)
    .map(
      (row, index) => `
                  <tr>
                    <td style="padding:${index === 0 ? '0' : '10px'} 0 0 0;">
                      <span style="display:block;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#7b817c;">${escapeHtml(
                        row.label,
                      )}</span>
                      <span class="dm-ink" style="display:block;padding-top:2px;font-size:15px;font-weight:600;color:#101211;">${escapeHtml(
                        row.value,
                      )}</span>
                    </td>
                  </tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>
  @media (prefers-color-scheme: dark) {
    .dm-bg { background-color: #0a0c0b !important; }
    .dm-card { background-color: #161918 !important; border-color: #2a2e2c !important; }
    .dm-ink { color: #f5f7f6 !important; }
    .dm-muted { color: #a8afab !important; }
    .dm-panel { background-color: #101312 !important; }
    .dm-rule { border-color: #2a2e2c !important; }
  }
  @media only screen and (max-width:600px) {
    .sm-p { padding-left: 22px !important; padding-right: 22px !important; }
  }
</style>
</head>
<body class="dm-bg" style="margin:0;padding:0;width:100%;background-color:#eaece7;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:#eaece7;">${escapeHtml(
    preheader,
  )}</div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="dm-bg" style="background-color:#eaece7;">
    <tr>
      <td align="center" style="padding:32px 12px;">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" style="width:520px;max-width:100%;">
          <tr>
            <td style="padding:0 4px 14px 4px;">
              <span class="dm-ink" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:17px;font-weight:700;letter-spacing:-0.02em;color:#101211;">Spllit</span>
            </td>
          </tr>

          <tr>
            <td class="dm-card" style="background-color:#ffffff;border:1px solid #e4e7e1;border-radius:14px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td class="sm-p" style="padding:30px 32px 0 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${
                    hi
                      ? `
                    <p class="dm-muted" style="margin:0 0 8px 0;font-size:15px;line-height:1.5;color:#4e544f;">Hi ${escapeHtml(
                      hi,
                    )},</p>`
                      : ''
                  }
                    <h1 class="dm-ink" style="margin:0 0 10px 0;font-size:21px;line-height:1.3;font-weight:700;letter-spacing:-0.02em;color:#101211;">${escapeHtml(
                      input.heading,
                    )}</h1>
                    <p class="dm-muted" style="margin:0;font-size:15px;line-height:1.6;color:#4e544f;">${escapeHtml(
                      input.body,
                    )}</p>
                  </td>
                </tr>${
                  detailRows
                    ? `
                <tr>
                  <td class="sm-p" style="padding:22px 32px 0 32px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="dm-panel" style="background-color:#f4f6f2;border-radius:10px;">
                      <tr>
                        <td style="padding:16px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${detailRows}
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`
                    : ''
                }
                <tr>
                  <td class="sm-p" style="padding:24px 32px 30px 32px;">${button(
                    input.actionLabel,
                    input.actionUrl,
                    true,
                  )}${
                    input.secondaryLabel && input.secondaryUrl
                      ? `
                  <!--[if mso]>&nbsp;&nbsp;<![endif]-->
                  <span style="display:inline-block;width:8px;"></span>${button(
                    input.secondaryLabel,
                    input.secondaryUrl,
                    false,
                  )}`
                      : ''
                  }
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 6px 0 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <p class="dm-muted" style="margin:0 0 10px 0;font-size:13px;line-height:1.6;color:#4e544f;">
                Or <a href="${escapeHtml(
                  appUrl,
                )}" style="color:#0a7d34;font-weight:600;text-decoration:none;">open the Spllit web app</a>.
              </p>
              <p style="margin:0;font-size:12px;line-height:1.6;color:#7b817c;">
                You are receiving this because you use Spllit.
                <a href="${escapeHtml(
                  appUrl,
                )}/settings/notifications" style="color:#7b817c;text-decoration:underline;">Manage notifications</a>.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Plain-text alternative. A message with no text part scores worse in filters,
 * and it is what a screen reader and a watch notification actually read.
 */
function renderText(input: SendInput, appUrl: string): string {
  const hi = greeting(input.name);
  const details = (input.details ?? []).filter((row) => row.value?.trim());

  return [
    ...(hi ? [`Hi ${hi},`, ''] : []),
    input.heading,
    '',
    input.body,
    ...(details.length
      ? ['', ...details.map((row) => `${row.label}: ${row.value}`)]
      : []),
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

/**
 * Renders a message without sending it.
 *
 * Exported for the tests, which is the only way to assert that a name
 * containing markup cannot break out of the template — and the only way to
 * check the preheader and the second button survive, both of which are
 * invisible in every other observation of this module.
 */
export function renderPreview(input: SendInput, appUrl = 'https://spllit.app'): {
  html: string;
  text: string;
} {
  return { html: render(input, appUrl), text: renderText(input, appUrl) };
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
        reply_to: input.replyTo?.trim() || cfg.replyTo,
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
 * A display name for one user id, or null.
 *
 * Shared by both acceptance messages so they cannot word the same fact two
 * ways. Every failure — missing row, blank name, database hiccup — returns
 * null, and the callers fall back to impersonal wording rather than withholding
 * the message: being told you are in matters more than being told by whom.
 */
async function nameOf(userId: string): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    return user?.name?.trim() || null;
  } catch {
    return null;
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
    name: to.name,
    subject: `${params.requesterName} wants to join ${params.squadName}`,
    preheader: `Approve or decline ${params.requesterName}'s request.`,
    heading: 'Someone wants to join your squad',
    body: 'Pick one below and we will take you there to confirm.',
    details: [
      { label: 'Who', value: params.requesterName },
      { label: 'Squad', value: params.squadName },
    ],
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
   * A missing name is not a reason to withhold the message — see `nameOf`.
   */
  const deciderName = params.decidedById ? await nameOf(params.decidedById) : null;

  const sent = await send({
    to: to.email,
    name: to.name,
    subject: deciderName
      ? `${deciderName} added you to ${params.squadName}`
      : `You're in — ${params.squadName}`,
    preheader: `You have a place in ${params.squadName}.`,
    heading: `You're in`,
    body: 'Open the squad to see the meeting point and who else is going.',
    details: [
      { label: 'Squad', value: params.squadName },
      ...(deciderName ? [{ label: 'Added by', value: deciderName }] : []),
    ],
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
  const whenLabel = formatWhen(params.whenAt);

  /**
   * The prose says what happens next; the rows carry the facts. Repeating the
   * join code in both would be the template writing itself twice.
   */
  const body = isSquad
    ? 'People at your college can find it now. We will email you the moment somebody asks to join.'
    : 'It is visible to people travelling your way. We will email you the moment somebody asks for a seat.';

  const details = [
    { label: isSquad ? 'Squad' : 'Route', value: params.title },
    ...(whenLabel ? [{ label: 'Leaving', value: whenLabel }] : []),
    ...(isSquad && params.joinCode
      ? [{ label: 'Join code — share to pull someone in', value: params.joinCode }]
      : []),
  ];

  const sent = await send({
    to: to.email,
    name: to.name,
    subject: isSquad ? `Your squad is live — ${params.title}` : `Your ride is posted — ${params.title}`,
    preheader: isSquad
      ? `${params.title} is live${whenLabel ? `, leaving ${whenLabel}` : ''}.`
      : `${params.title} is posted${whenLabel ? `, leaving ${whenLabel}` : ''}.`,
    heading: `Your ${noun} is live`,
    body,
    details,
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
 * Tells a ride's host that somebody wants a seat, and offers both answers.
 *
 * Same shape as the squad version, and the same rule: the two buttons are
 * ordinary links to one decision page and differ only in a `#fragment`, which
 * never reaches the server. Mail is fetched by scanners before a person reads
 * it, so nothing may be decided by a link being opened.
 *
 * The URL carries the match id where the squad one carries a hashed token.
 * That is safe here because the id authorises nothing — the route re-reads the
 * ride, requires the caller to be its host, and requires the request to still
 * be pending. See the block above the routes in routes/ridesPlatform.ts.
 */
export async function emailRideJoinRequested(params: {
  hostId: string;
  rideId: string;
  rideLabel: string;
  requesterName: string;
  /**
   * The pending Match. Without it both buttons fall back to the ride page,
   * where the host can still answer — the mail must go out either way.
   */
  matchId?: string;
}): Promise<void> {
  const cfg = config();
  if (!cfg) return;

  const to = await recipientFor(params.hostId, EMAIL_CATEGORIES.JOIN_REQUEST, params.rideId);
  if (!to) return;

  const base = params.matchId
    ? `${cfg.appUrl}/rides/${params.rideId}/requests/${params.matchId}`
    : `${cfg.appUrl}/rides/${params.rideId}`;

  const sent = await send({
    to: to.email,
    name: to.name,
    subject: `${params.requesterName} wants a seat — ${params.rideLabel}`,
    preheader: `Approve or decline ${params.requesterName}'s request.`,
    heading: 'Someone wants a seat on your ride',
    body: 'Pick one below and we will take you there to confirm.',
    details: [
      { label: 'Who', value: params.requesterName },
      { label: 'Ride', value: params.rideLabel },
    ],
    actionLabel: 'Give them a seat',
    actionUrl: params.matchId ? `${base}#approve` : base,
    secondaryLabel: 'Decline',
    secondaryUrl: params.matchId ? `${base}#decline` : base,
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
 * Tells a rider they have a seat, and who gave it to them.
 *
 * Same category as the squad acceptance — mandatory, and exempt from quiet
 * hours. It answers something the person asked for and then went to sleep
 * wondering about, and being left unsure whether you have a lift tomorrow is
 * worse than an email at 1am that does not buzz your phone.
 */
export async function emailRideRequestAccepted(params: {
  userId: string;
  rideId: string;
  rideLabel: string;
  decidedById?: string;
}): Promise<void> {
  const cfg = config();
  if (!cfg) return;

  const to = await recipientFor(params.userId, EMAIL_CATEGORIES.REQUEST_ACCEPTED, params.rideId);
  if (!to) return;

  const hostName = params.decidedById ? await nameOf(params.decidedById) : null;

  const sent = await send({
    to: to.email,
    name: to.name,
    subject: hostName
      ? `${hostName} gave you a seat — ${params.rideLabel}`
      : `You have a seat — ${params.rideLabel}`,
    preheader: `You have a seat on ${params.rideLabel}.`,
    heading: 'You have a seat',
    body: 'Open the ride to see the pickup point and message your host.',
    details: [
      { label: 'Ride', value: params.rideLabel },
      ...(hostName ? [{ label: 'Host', value: hostName }] : []),
    ],
    actionLabel: 'Open the ride',
    actionUrl: `${cfg.appUrl}/rides/${params.rideId}`,
    secondaryLabel: 'Open Spllit',
    secondaryUrl: cfg.appUrl,
    idempotencyKey: `ride-request-accepted:${params.rideId}:${params.userId}`,
  });

  if (sent) {
    await recordEmailSent({
      userId: params.userId,
      category: EMAIL_CATEGORIES.REQUEST_ACCEPTED,
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
    /**
     * Deliberately no `name` here, where every other message passes one.
     *
     * The heading below already greets them by name, and the template adds
     * "Hi Ankit," above the heading when given one — so passing it produces
     * "Hi Ankit, / Welcome, Ankit". One greeting per message.
     */
    subject: 'Welcome to Spllit',
    preheader: 'Find people going your way, and split the fare.',
    heading: `Welcome, ${first}`,
    /**
     * No detail rows here, deliberately. A welcome has no facts to look up —
     * adding a panel for the sake of matching the other messages is the
     * template filling itself in, which is the thing these rows exist to avoid.
     */
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
/**
 * Confirmation that an application arrived.
 *
 * WHAT TRIGGERS THIS. Applications are collected on a Google Form, which is
 * hosted by Google and tells us nothing on its own — there is no callback from
 * a form submission to this server. This is therefore fired by a small Apps
 * Script bound to the form's onFormSubmit trigger, which posts here. That means
 * two things worth being clear about: no email goes out unless that script is
 * installed on the form, and this endpoint is told the address rather than
 * looking it up, so it can only be as accurate as what the applicant typed.
 *
 * Deliberately plain. Somebody has just spent twenty minutes on a form for a
 * job they want; the useful reply says what happened, what happens next, and
 * roughly when — not how excited we are. No detail rows either: there is one
 * fact here and it is in the heading.
 */
export async function emailApplicationReceived(params: {
  to: string;
  name?: string;
  roleTitle: string;
  /** Used for the idempotency key, so a form retry cannot send twice. */
  submissionId: string;
}): Promise<boolean> {
  const cfg = config();
  if (!cfg) return false;

  const role = params.roleTitle.trim() || 'the role you applied for';

  return send({
    to: params.to,
    name: params.name,
    subject: `We have your application — ${role}`,
    preheader: `It is in. Here is what happens next, and roughly when.`,
    heading: 'Your application is in',
    body:
      `Thanks for applying for <strong>${escapeHtml(role)}</strong>. A person reads every ` +
      `application here — there is no filter deciding for us, and no automated rejection.` +
      `<br><br>` +
      `We read in batches rather than as they arrive, so give us about a week. If what you ` +
      `sent fits, you will hear from someone directly to arrange a conversation. If it does ` +
      `not, you will still hear from us — we would rather tell you than leave you wondering.` +
      `<br><br>` +
      `If you have something that says more than a form can — a repository, a piece of ` +
      `writing, something you built that nobody asked you to build — reply to this email and ` +
      `send it. It gets read with the rest of your application.`,
    actionLabel: 'See what we are building',
    actionUrl: `${cfg.appUrl}/careers`,
    // A reply to this is about a job, not a support issue.
    replyTo: CAREERS_EMAIL,
    idempotencyKey: `careers-application:${params.submissionId}`,
  });
}

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
