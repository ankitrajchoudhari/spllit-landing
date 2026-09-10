# Admin console — `admin.spllit.app`

The founder/operations console for Spllit. A **separate Next.js app** in `admin/`,
deployed as its own Cloudflare Worker, talking to the existing backend over an
authenticated API.

Phase 1 (foundation) is built. Later phases and the reasoning behind the plan
are in [the inspection report](https://claude.ai/code/artifact/a7ece0d0-0223-4b87-a47a-b26ffadfbc79);
current status is at the bottom of this file.

---

## Why a separate app

The main site's bundle never carries admin code, and an admin deploy cannot
take down `spllit.app` — they are different Workers with different release
cycles. The cost is that the design tokens are duplicated in
`admin/tailwind.config.ts` and `admin/app/globals.css` rather than imported;
that is deliberate, and the token *names* match the main app exactly so a
component moved between them keeps meaning the same thing.

```
spllit.app          →  Worker "spllit-landing"   (app/, components/, lib/)
admin.spllit.app    →  Worker "spllit-admin"     (admin/)
                            │
                            └── HTTPS ──► api.spllit.app  (Cloud Run, backend/)
                                              └── MongoDB (Prisma)
```

## Authentication

An admin is **a Spllit user whose row carries a console role**. There is no
second password store.

1. Sign in through Firebase — the same project as `spllit.app`, Google or
   email/password.
2. The console calls `GET /api/admin-console/me` with the Firebase ID token.
3. The backend resolves the caller's role **from the database, on every
   request**, and answers `404` if they have none.

Signing in proves identity and nothing else. Whether you may see anything is
decided server-side, every time. `admin/components/guard.tsx` chooses which
screen to render; defeating it in a browser console gets you a rendered layout
and a series of 404s from the API.

### Roles

Five roles, defined in `backend/src/config/adminRoles.ts` — the single source of
truth. `admin/lib/permissions.ts` mirrors the vocabulary for rendering only.

| Role | Can |
|---|---|
| `analyst` | Dashboard, analytics, exports. No individual user or content access. |
| `support` | Look up and correct users. Cannot suspend. |
| `moderator` | Act on content and suspend users. Cannot configure the platform. |
| `admin` | Run the platform day to day. Cannot manage other admins. |
| `super_admin` | Everything, including deleting users and granting roles. |

Roles live in a **new** optional `User.adminRole` field. The legacy
`role` / `isAdmin` / `adminStatus` fields were not touched — the user-facing app
and the old `/api/admin` routes read them, and widening their vocabulary would
change what those reads mean.

When `adminRole` is unset, the console derives one from the legacy fields
(`role: 'admin'` → `super_admin`, `role: 'subadmin'` or `isAdmin` → `admin`).
**So every existing admin keeps working with no migration.**

Two escalation guards, both in `adminConsole.ts`:

- You cannot change your own role or your own account status.
- You must strictly outrank both what someone *is* and what you are making
  them. Equal rank is refused — otherwise two admins can demote each other, and
  an `admin` could mint a `super_admin` who promotes them back.

### Creating the first Super Admin

The account must have signed in to `spllit.app` at least once, so a `User` row
exists.

```bash
cd backend
node scripts/grant-console-role.mjs you@spllit.app super_admin
```

After that, use the console's **Admins** page — it enforces the rank rules and
writes an audit row, neither of which a script can meaningfully do.
`node scripts/grant-console-role.mjs <email> none` revokes.

## Audit log

Every privileged action writes an `AuditLog` row through
`backend/src/services/auditLog.ts`, including **failed attempts** — a refused
ban is exactly what someone reviewing the log later wants to see.

Two rules the code enforces:

- A failed audit write never fails the action it describes. Losing the ability
  to suspend an abusive account because a log insert timed out is worse than a
  gap in the log, so `record()` swallows and reports its own errors.
- Only changed fields are stored, capped at 40 keys and 500 chars each, with
  `password`, `phoneHash` and token fields redacted. Audit rows outlive the
  records they describe; copying documents wholesale would quietly build a
  second permanent copy of everyone's personal data.

Destructive actions (`users.suspend`, role changes) **require a reason**, so the
log explains itself months later.

## API

Mounted at `/api/admin-console`. A new namespace, not an extension of
`/api/admin-panel` — that router serves the existing in-app admin page and its
shapes must not change.

| Route | Permission |
|---|---|
| `GET /me` | any admin |
| `GET /overview`, `GET /signups` | `dashboard.view` |
| `GET /users`, `GET /users/:id` | `users.view` |
| `PATCH /users/:id/status` | `users.suspend` |
| `PATCH /users/:id/role`, `GET /admins` | `admins.manage` |
| `GET /audit` | `audit.view` |
| `GET /flags` | `settings.view` |
| `PATCH /flags/:key` | `flags.edit` |
| `GET /system` | `system.view` |
| `GET /activity`, `GET /series` | `dashboard.view` |
| `GET /analytics` | `analytics.view` |

Phase 2 added a second router, `routes/adminConsoleOps.ts`, on the same mount
path. Their prefixes do not overlap, so ordering between the two is not load
bearing.

| Route | Permission |
|---|---|
| `GET /rides`, `GET /rides/:id` | `content.view` |
| `GET /squads`, `GET /squads/:id` | `content.view` |
| `GET /events`, `GET /events/:id` | `content.view` |
| `GET /communities`, `GET /communities/:id` | `content.view` |
| `GET /notifications` | `content.view` |
| `PATCH /events/:id/status` | `content.delete` |
| `GET /emergencies`, `GET /moderation/status` | `moderation.view` |
| `GET /search` | `users.view` |
| `GET /settings` | `settings.view` |
| `PATCH /settings/:key` | `settings.edit` |
| `POST /broadcast/preview`, `POST /broadcast` | `notifications.send` |
| `GET /export/:dataset` | `exports.run` **and** the dataset's own permission |

`identify` + `requireConsoleAdmin` are applied once at the router level so a new
handler cannot ship ungated by someone forgetting to repeat them.

`GET /search` additionally narrows *within* the handler: it checks the caller's
`content.view` and `audit.view` before running those groups, so a Support user
searching gets people and nothing else rather than a 403 for the whole palette.

## Database

Seven additive models in `backend/prisma/schema.prisma` — `AuditLog`,
`FeatureFlag`, `PlatformSetting`, and from Phase 3 `MetricCounter`,
`MetricRollup` and `ActivityEvent`, and from Phase 4 `ActiveUserDay` — plus
the optional `User.adminRole` field.
No existing model or field was changed.

`MetricRollup`'s id is `<metric>:<YYYY-MM-DD>` rather than a cuid, so an
increment is one keyed upsert with no lookup first. Two writes in the same
millisecond then collide on the primary key instead of quietly creating a second
bucket for the same day and halving the figure the dashboard shows.

MongoDB creates collections on first write, so there is no migration step:

```bash
cd backend && npx prisma db push && npx prisma generate
```

**Indexes still to add** before this carries real volume — the audit log's
`@@index` declarations cover its own queries, but `prisma/indexes.mjs` defines
only four custom indexes platform-wide. See Phase 4.

## Environment

`admin/.env.example` is the template. Every variable is `NEXT_PUBLIC_` and is
inlined into the browser bundle at build time — which is safe **only because
none of them is a secret**. The Mongo URL, Firebase Admin service account,
Mapbox server token and Razorpay keys stay on the backend.

> If you ever want to add a secret to that file, the operation it belongs to
> belongs on the backend instead.

Because they are build-time values, they go in the Cloudflare dashboard's
**build-time environment variables**, not `wrangler.jsonc` `vars` — setting them
at runtime has no effect on a bundle that is already built.

The backend needs `ADMIN_URL=https://admin.spllit.app` for CORS (the literal
origin is also hardcoded in the allowlist as a fallback).

## Running locally

```bash
cd backend && npm run dev     # :3001
cd admin   && npm install     # first time only
cd admin   && npm run dev     # :3100
```

Port 3100 keeps it clear of the main app's 3000 and is already in the backend's
CORS allowlist.

## Deployment

```bash
cd admin && npm run deploy    # opennextjs-cloudflare build && deploy
```

This does **not** touch the `spllit.app` deploy — different Worker, different
command. There is no GitHub Actions workflow for it yet; add one modelled on
`.github/workflows/deploy-frontend.yml` when you want it on push.

### DNS

The brief assumed Vercel. **There is no Vercel** — the frontend runs on
Cloudflare Workers via OpenNext, and the leftover `vercel.json` at the repo root
is not what ships. So:

1. Cloudflare dashboard → Workers & Pages → `spllit-admin` → Settings → Domains
   → **Add custom domain** → `admin.spllit.app`.
2. If `spllit.app` is on Cloudflare nameservers, the record is created for you.
3. If DNS is still at Name.com, add the `CNAME` Cloudflare shows you
   (`admin` → the workers.dev target) with proxying handled by Cloudflare.

The console sends `X-Robots-Tag: noindex` and `X-Frame-Options: DENY` from both
`next.config.mjs` and its metadata — an admin console in search results is a
straightforward leak of what the platform runs.

## Status

**Phases 1 (foundation), 2 (operations), 3 (realtime), 4 (analytics) and
5 (settings, broadcasts, exports): done.**

Verified on every run: backend `tsc` clean + **186 tests pass**; admin `tsc`
clean, lints clean, production build clean (**16 routes**); main app `tsc`
clean, lints clean, **150 tests pass**.

### Built

Phase 1 — foundation:

- [x] Five-role RBAC with a permission matrix and legacy fallback
- [x] Server-side authorisation on every route; no frontend-only checks
- [x] Audit log — successes *and* failures, reasons required, PII redacted
- [x] Separate app, own Worker, own config, dark Spllit-token UI
- [x] Sign-in, session guard, sidebar, loading/empty/error/permission states
- [x] Dashboard, Users, Audit, Flags, Admins, System

Phase 2 — operations:

- [x] Rides, Squads, Events, Communities — list + detail, server-side search,
      filtering, sorting and pagination throughout
- [x] User 360: profile, account, counts, rides, squads, communities, events,
      and **two separate audit trails** — what admins did *to* the account, and
      what the account did *as* an admin
- [x] Suspend / restore, and event cancellation — each one confirmed, reasoned,
      audited, and rank-checked on the server
- [x] Notifications with a real open rate, and an explicit note that Spllit
      records no per-device delivery receipt
- [x] Moderation surfacing what genuinely exists (SOS, blocks) and stating
      plainly that reporting does not
- [x] Global search over six entity types, behind ⌘K, capped at five hits per
      group and permission-filtered per group
- [x] Toasts, breadcrumbs, confirmation dialogs, grouped sidebar
- [x] **25 tests** on the security logic — the permission matrix, the
      escalation guards, audit redaction and the diff

Phase 3 — realtime:

- [x] `MetricCounter` / `MetricRollup` / `ActivityEvent`, incremented on write
      rather than recounted
- [x] A Prisma query extension as the single instrumentation point — ten models
      observed, zero route files edited
- [x] A dedicated `/admin` Socket.IO namespace, isolated from the one carrying
      user positions and chat, refusing non-admins at the handshake
- [x] Live activity feed: backlog fetched **once**, everything after it by event
- [x] Live/reconnecting/offline indicator with a 60s polling fallback
- [x] Drift-free deltas derived from timestamps, not a running tally
- [x] **3 more tests** on the event catalogue's invariants

Phase 4 — analytics:

- [x] `ActiveUserDay`, recorded from the authentication middleware with an
      in-memory cache collapsing a user's whole day into one write
- [x] DAU / WAU / MAU, stickiness, and a daily active-user chart
- [x] Retention by signup-day cohort at D1 / D7 / D30, with unreached days
      reported as null rather than zero
- [x] Activation funnel over distinct users, not events
- [x] Feature adoption across rides, squads, events, communities and chat
- [x] The dashboard's "Seen today" now reads real DAU instead of `lastSeen`
- [x] **3 more tests** on the active-user deduplication

Phase 5 — settings, broadcasts, exports:

- [x] Platform settings with per-setting sensitivity, server-side type checking
      and mandatory reasons on the sensitive ones
- [x] Broadcast composer: size the audience first, confirm against that number,
      audit before sending, hard cap at 5,000
- [x] CSV / JSON exports with explicit column lists, a double permission gate
      and a stated 10,000-row cap

### Not built, and why

- [ ] **Reports queue** — Spllit has no `Report` model and no way for a user to
      report anyone. It needs product work in the main app, which was out of
      scope. The console says so rather than showing an empty queue.
- [ ] **Posts / comments** — Spllit has no such feature. Not applicable.
- [ ] **Chat message content** — deliberately unreachable. Squad and community
      chat show volume and last activity only. Reading private conversations
      needs a report or support ticket naming the thread, and neither exists
      yet, so the console offers no route to the messages at all.

## Phase 3 — realtime

**Built.** The console updates from events, not from a faster poll.

### What changed

`GET /overview` used to answer every figure with a live `count()`. The volatile
ones — the figures events move — now come from `MetricCounter`, a single keyed
read of all counters at once. What stayed a live count is the set of figures
that are *states* rather than events: rides currently active, accounts
currently suspended. Those cannot be derived by incrementing, because a row
changing status is not a write anybody counts.

```
Spllit app  ──▶  Prisma extension  ──┬──▶  MetricCounter   (lifetime, incr)
  (any create)   (utils/prisma.ts)   ├──▶  MetricRollup    (per UTC day, incr)
                                     ├──▶  ActivityEvent   (feed row, pruned)
                                     └──▶  io.of('/admin') (room: metrics)
                                                  │
                                                  ▼
                                          admin.spllit.app
                                    (figures on load, deltas after)
```

### The instrumentation point

**One file, not fifteen.** `utils/prisma.ts` wraps the client in a `$extends`
query extension that observes `create` on the ten models the console reports
on. The alternative was an emit inside each route handler — which means editing
files the live user-facing app depends on, and means every future write path
silently going unreported until somebody remembers to add one.

Each handler runs `query(args)` first and reports only once it resolves, so
nothing is announced that did not commit. None of them awaits the reporting.
`metricCounter`, `metricRollup` and `activityEvent` are deliberately absent from
the observed list — they are what the reporting writes, and observing them would
have each event trigger another.

`ADMIN_ACTION` comes from `auditLog.record()` instead, which every privileged
mutation already passes through.

### Why a namespace, not a room

`io.of('/admin')` rather than an `admin:metrics` room on the default namespace.
`services/live.ts` owns that namespace and carries every user's positions,
presence and chat; adding an admin room to it would mean editing the file the
live map depends on, and putting admin fan-out one stray `broadcast.emit` away
from every user's phone. A namespace is isolated by construction.

Authentication there is a **connection** gate, not a room gate. `live.ts` lets
unauthenticated sockets connect and refuses their room joins, because a public
map still has something to show them. Nothing in `/admin` is public, so a
non-admin is refused the handshake outright.

### Connection states

The indicator never claims to be live when it is not — a stale dashboard
reading "Live" invites someone to act on figures that stopped moving ten
minutes ago.

| State | Meaning |
|---|---|
| `connecting` | Opening the connection. |
| `live` | Connected; figures move as events arrive. |
| `reconnecting` | Dropped and retrying. Figures may be stale. |
| `offline` | Gave up, or was refused. **Falls back to 60s polling.** |
| `disabled` | No `NEXT_PUBLIC_SOCKET_URL` at build time. Polling. |

### Deltas without drift

The dashboard still refetches its real figures every 60 seconds, so a running
tally of live events would keep adding on top of numbers that had already
absorbed them — every counter drifting upward the longer a tab stayed open.

Instead the client keeps *timestamped* ticks and asks `deltaSince(metric,
overview.dataUpdatedAt)`. The delta is exactly what has happened since the
figures left the server; on each refetch the base moves forward and the delta
collapses to zero on its own. Nothing to reset, nothing double counted.

### Backfill

Counters start empty and fill from the first write after this shipped.
**Existing history is not backfilled**, so lifetime totals read lower than the
collections actually hold until it is. `/overview` sends `counters` raw
alongside the figures so a genuine zero stays distinguishable from a metric that
is not yet recording.

### Still to do

`MESSAGE_SENT` and `NOTIFICATION_SENT` are counted but withheld from the feed —
at real volume they would push everything else off it within seconds. If the
feed ever needs them, it needs a filter first.

## Phase 4 — analytics

**Built.** Retention, funnels and feature adoption, on top of the rollups Phase
3 established.

### Why `ActiveUserDay` had to exist

`User.lastSeen` cannot answer any of this. It is written at login and nowhere
else, so it records a last *login* rather than activity, and it holds a single
instant — there is no history in it to draw a retention curve from. The
dashboard's "Seen today" was labelled an approximation for exactly that reason;
it now reads real DAU instead, so the same question is not answered two
different ways on two different pages.

`ActiveUserDay` is one row per user per UTC day, and deliberately holds **no
event detail**. That is all DAU, WAU, MAU and retention need; recording what
each person did would make it a behavioural log of every user, kept
indefinitely, to compute numbers that never look at the contents.

### Cost of marking someone active

`markActive()` is called from `middleware/identity.ts`, which runs on every
authenticated request — the hottest path in the application. A write per
request would be the single most expensive thing Spllit does, so an in-memory
set collapses a user's entire day of traffic into **one upsert**.

The cache is per-container, not global. Several containers each write the same
user once, which is why the id is `<userId>:<day>` — the upsert collapses those
duplicates at the database rather than trusting any one process to have seen
everything. A failed write is dropped from the cache so the user's next request
retries it, rather than losing them for the rest of the day.

### What each figure costs

Every query is bounded by the number of **active** users in the window, never
by the size of the User collection. A distinct count over 30 days touches one
row per active user per day and nothing else, so a user who never returns costs
nothing to ignore.

`distinctActive` uses `groupBy` rather than a count: with one row per user per
day, the number of groups *is* the distinct user count, and the result set is
bounded by the answer itself — asking for MAU returns exactly MAU rows.

The trade is stated rather than hidden: these are computed on demand, not
pre-aggregated. If MAU ever takes long enough to notice, the fix is a nightly
rollup of the distinct counts, not another index.

### Retention

"Retained on day N" means active on **that specific day**, not merely active at
some point since. The looser definition only ever goes up with time and so
flatters every cohort; this one answers whether people actually came back.

A cohort too young to have reached day N reports `null`, rendered as a dash — a
cohort that signed up yesterday has not failed its D7, it has no D7 yet, and
showing that as 0% would make every recent cohort look like a catastrophe.

### Funnel

Each step counts **distinct users who reached it**, not events. A user with
nine rides is one person who reached "created a ride"; counting rides would
make the funnel widen at the bottom. "Did something" is the union of the
participation steps, not their sum, so one person who both hosted a ride and
joined a squad counts once.

### Backfill

`ActiveUserDay` starts filling from the first authenticated request after this
shipped. Days before that read as zero because nothing was recorded, not
because nobody was there — the payload carries that caveat in `notes` and the
page renders it above the figures rather than in a footnote.

## Settings, broadcasts and exports

The three surfaces that change something *outside* the console: a setting every
user's app reads, a notification that lands on their phone, and a file of their
data leaving the building. Each is deliberately harder to do by accident than
the read-only pages.

**Settings.** `requiresConfirmation` travels with the setting rather than
living in the UI, so a dangerous switch cannot become a one-click toggle by
being rendered somewhere new — when it is set, the reason is mandatory on the
server too, not only in the dialog that asks for it. Values are checked against
the setting's declared `valueType`: a boolean quietly becoming the string
`"false"` is truthy everywhere it is read.

**Broadcasts.** Two steps, always. The send button stays disabled until the
audience has been *sized*, because "notify everyone" should be a decision made
against a number rather than a guess, and the confirmation repeats that number
back. Changing the audience or the message invalidates the count, so the
confirmation can never quote a figure for a different send.

The audit row is written **before** the send, not after. A broadcast cannot be
recalled; if the send fails partway through, the record of who ordered it and
why must already exist — a row written only on success would be missing for
exactly the send that went wrong. There is a hard cap of 5,000 recipients,
which is a safety limit rather than a pagination one.

**Exports.** An explicit column list per dataset, never `SELECT *`. An export is
the one place data leaves in bulk, and a field added to a model later must not
join the file automatically — `phoneHash`, `password` and `fcmTokens` are
precisely what a wildcard would have carried.

Two permissions are required: the dataset's own, and `exports.run`. A Support
user can read users in the console without being able to walk out with a file
of them. Capped at 10,000 rows, and the response says so in
`X-Export-Truncated` — the brief asks for background jobs beyond that and
Spllit has no job queue, so the cap is stated rather than pretended around.

## Not built

| Surface | Why |
|---|---|
| Reports queue | Spllit has no `Report` model and no way for a user to report anyone. Needs product work in the main app. |
| Posts / comments | No such feature in Spllit. |
| Chat message content | Deliberately unreachable. Volume and last activity only. |
| `SYSTEM_ERROR` events | Needs an error aggregation service. |
| Data explorer | The original spec's Phase 6. Needs a controlled query layer — dimensions and metrics, never raw queries from the browser. |

## Decisions taken

Four questions were open in the inspection report; asked to decide, I took these:

1. **Auth** — consolidate on `User.adminRole` + Firebase. The legacy `Admin`
   collection and `/api/admin/login` were left running, untouched.
2. **Separate app** — yes, `admin/` as its own Worker.
3. **Reporting** — skipped. It requires changing the main app, which was
   explicitly out of scope. Moderation is shown as unavailable, not faked.
4. **Firestore** — proceeded on Prisma. The 2026-08-07 decision to migrate
   users to Firestore is still unimplemented; if it goes ahead, the user reads
   in `adminConsole.ts` are the migration surface.
