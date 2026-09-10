# Transactional email

How Spllit sends email, why it is built the way it is, and what has to be true
for it to reach an inbox rather than a spam folder.

Two message types exist, deliberately:

| Event | Recipient |
| --- | --- |
| `squad.join_requested` | the squad leader |
| `squad.request_accepted` | the person who asked |

Every additional type is another way to end up in spam, so the list grows only
when there is a reason a push notification cannot serve instead.

---

## Not the campaign mailer

`services/emailService.ts` sends CSV campaigns through a Gmail or Zoho mailbox.
It is **not** the transport for any of this, and reusing it would be a mistake:
transactional mail needs delivery webhooks, an automatic suppression list, and a
sending reputation that is not shared with marketing. The two stay separate.

---

## Phase 1 — DNS (do this before anything else)

If DNS is wrong, everything after it lands in spam and you will debug the wrong
layer for a week. Nothing in Phase 2 works until this is verified.

### 1. Resend account

1. Sign up at <https://resend.com>.
2. **Domains → Add Domain** → enter **`mail.spllit.app`**.
3. Pick the region closest to your users. Resend's DNS values differ per region,
   so choose before copying anything.

**Why a subdomain and not `spllit.app`.** Sending reputation is per-domain. A
campaign that draws complaints on `mail.spllit.app` cannot damage the root — and
the root is where `/__/auth/handler` lives, so its reputation is load-bearing for
sign-in, not just for mail.

### 2. Cloudflare DNS

Resend shows the exact values after you add the domain. Copy them; do not type
them from memory, and do not copy the ones below — they show the *shape* only.

| Type | Name (as typed in Cloudflare) | Value | Proxy |
| --- | --- | --- | --- |
| `MX` | `send.mail` | `feedback-smtp.<region>.amazonses.com` (priority 10) | DNS only |
| `TXT` | `send.mail` | `v=spf1 include:amazonses.com ~all` | DNS only |
| `TXT` | `resend._domainkey.mail` | the long `p=…` DKIM key Resend gives you | DNS only |

Three things that trip people up in Cloudflare specifically:

- **Type the short name.** Cloudflare appends the zone. Entering
  `send.mail.spllit.app` creates `send.mail.spllit.app.spllit.app`.
- **Proxy must be DNS only (grey cloud).** MX and TXT cannot be proxied; if the
  UI offers an orange cloud on anything here, something else is wrong.
- **The DKIM value is long and must be exact.** Paste it, then re-open the record
  and compare the end of the string — truncation is the usual failure and Resend
  reports it as an unverified domain with no explanation.

### 3. DMARC

Add one more record, and start permissive:

| Type | Name | Value |
| --- | --- | --- |
| `TXT` | `_dmarc.mail` | `v=DMARC1; p=none; rua=mailto:dmarc@spllit.app` |

`p=none` means "publish reports, enforce nothing". Read them for a couple of
weeks, confirm only Resend is sending as you, then move to `p=quarantine` and
later `p=reject`. Starting at `reject` will bounce your own mail the first time
a record is slightly wrong.

If `spllit.app` already publishes DMARC with an `sp=` policy, that policy applies
to this subdomain until the record above overrides it — worth checking, because
an inherited `sp=reject` will fail every message before you have seen a report.

### 3b. The inherited-policy trap (real, and it bit this domain)

`spllit.app` already publishes DMARC:

```
v=DMARC1; p=quarantine; rua=...; sp=quarantine; adkim=r; aspf=r; pct=100
```

`sp=quarantine` is the *subdomain* policy, and it applies to `mail.spllit.app`
from the moment it sends — a record on the subdomain is what overrides it, and
without one there is no `p=none` phase at all, whatever you meant to publish.

This is survivable rather than fatal, because `adkim=r` and `aspf=r` are relaxed:
DKIM signed by `mail.spllit.app` aligns with the organisational domain
`spllit.app`, so a correctly authenticated message passes and is never
quarantined. What it removes is the *margin*. On a domain with no reputation
yet, any authentication hiccup goes straight to a spam folder rather than being
delivered and reported, and you find out from a user rather than from a report.

Publish the subdomain record during warm-up:

| Type | Name | Value |
| --- | --- | --- |
| `TXT` | `_dmarc.mail` | `v=DMARC1; p=none; rua=mailto:support@spllit.app` |

Then tighten it to match the root once the reports are clean.

### 4. Verify

Resend's dashboard shows the domain as verified once it can see all three
records. Propagation is usually minutes. If it stalls:

```bash
dig +short TXT resend._domainkey.mail.spllit.app
dig +short TXT send.mail.spllit.app
dig +short MX  send.mail.spllit.app
```

Nothing returned means the record is not published — most often the
double-suffix mistake above.

### 5. Sender identity

- `From: Spllit <notifications@mail.spllit.app>`
- `Reply-To: support@spllit.app`

The reply-to matters. People reply to transactional mail, and a reply that
disappears into a no-reply mailbox is a support failure that nobody can see.

### 6. Warm up

Send low volume for the first week or two. A brand-new domain that suddenly
emits hundreds of messages looks exactly like a compromised one.

---

## Phase 2 — sending (built)

`services/email.ts`. Deliberately small, and deliberately best-effort.

- **Fail-closed.** Without `RESEND_API_KEY` nothing sends and nothing throws.
  An install that has not configured mail is quiet, not broken.
- **Verified addresses only.** `User.emailVerified` must be true. Sending to an
  address nobody proved they own is how a domain collects hard bounces, and hard
  bounces are what get a sender blocked.
- **Never fails the action.** A join request must not fail because mail failed.
  Same rule as the analytics `observe()` hook in `utils/prisma.ts`: the user's
  write has already committed and a delivery problem cannot be allowed to undo
  it.
- **The in-app notification is the source of truth.** Email is a copy that may
  or may not arrive. Nothing may exist only in an email.
- **`List-Unsubscribe` and `List-Unsubscribe-Post` on every message.** Gmail and
  Yahoo have required one-click unsubscribe from bulk senders since February
  2024. It is not optional and it is not only for marketing.
- **Plain `fetch`, no SDK.** One POST to `https://api.resend.com/emails` against
  a stable REST API, versus a dependency and its transitive tree in a service
  that already deploys from source on every push.

### Environment

```
RESEND_API_KEY=            # absent disables all sending
EMAIL_FROM=Spllit <notifications@mail.spllit.app>
EMAIL_REPLY_TO=support@spllit.app
APP_URL=https://spllit.app # used to build links in emails
```

`RESEND_API_KEY` belongs in Secret Manager alongside the others. It is optional
in `scripts/gcloud-deploy.mjs` for the fail-closed reason above.

---

## Phase 3 — accepting from the email (built)

`services/joinRequestTokens.ts`, the two `/api/squads/join-requests/:token`
endpoints, and the page at `/squads/[id]/requests/[token]`.

The rule that shapes all of it: **the token identifies, the session
authorises.** The token says which request is being answered; the session says
who is answering. A forwarded email hands its recipient a pointer to a request
they still cannot act on.

### Email links are clicked by machines

Outlook Safe Links, Gmail's proxy, corporate scanners and antivirus all fetch
URLs in mail before a human sees them. So:

> **Never mutate state on GET from an email.**

A GET "accept" link is accepted by a scanner before the leader reads the
message. The flow must be: link (GET) → page → explicit POST.

### Forwarding

If a token alone authorises the action, forwarding the email hands a stranger the
power to admit someone into a squad that shares live location. Hence the decided
position:

> **The link opens the app with the action pre-loaded and requires a session.**

On mobile the leader is usually already signed in, so it is one tap in practice —
the same flow GitHub, Linear and Slack use. The token identifies *which request*,
the session proves *who is answering it*.

### Token requirements

| Property | Reason |
| --- | --- |
| 32 random bytes, stored hashed | A signed token in a URL cannot be revoked; a row can |
| Bound to action + squadId + requestId + leaderId | Cannot be replayed elsewhere |
| Single use | A forwarded email is spent once |
| ~72h expiry | Roughly how long a join request stays meaningful |
| Invalidated when the request is answered by any route | Accepting in-app must kill the emailed link |
| Rate limited per token and per IP | It is an unauthenticated endpoint until the session check |

---

## Phase 4 — preferences and suppression (not built)

- Per-category preferences; unsubscribe writes to them.
- Resend webhooks for bounces and complaints feed a suppression list that is
  checked before every send. A hard bounce retried is how domains get blocked.
- Unsubscribe must work without a session — the link is in an email.

## Phase 5 — batching (not built)

Five join requests in ten minutes should be one email. Cloud Run has no timers,
so this belongs on the existing Cloud Scheduler job that already calls
`/api/maintenance/sweep`. Add quiet hours in the recipient's timezone, and skip
email entirely to someone who has been active in-app in the last few minutes —
they have already seen the notification.
