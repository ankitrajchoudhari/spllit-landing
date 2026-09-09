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

`identify` + `requireConsoleAdmin` are applied once at the router level so a new
handler cannot ship ungated by someone forgetting to repeat them.

`GET /search` additionally narrows *within* the handler: it checks the caller's
`content.view` and `audit.view` before running those groups, so a Support user
searching gets people and nothing else rather than a 403 for the whole palette.

## Database

Three additive models in `backend/prisma/schema.prisma` — `AuditLog`,
`FeatureFlag`, `PlatformSetting` — plus the optional `User.adminRole` field.
No existing model or field was changed.

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

**Phase 1 (foundation) and Phase 2 (operations): done.**

Verified on every run: backend `tsc` clean + **180 tests pass**; admin `tsc`
clean, lints clean, production build clean (**14 routes**); main app `tsc`
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

### Not built, and why

- [ ] **Reports queue** — Spllit has no `Report` model and no way for a user to
      report anyone. It needs product work in the main app, which was out of
      scope. The console says so rather than showing an empty queue.
- [ ] **Posts / comments** — Spllit has no such feature. Not applicable.
- [ ] **Chat message content** — deliberately unreachable. Squad and community
      chat show volume and last activity only. Reading private conversations
      needs a report or support ticket naming the thread, and neither exists
      yet, so the console offers no route to the messages at all.
- [ ] **Analytics** — needs `AnalyticsEvent` plus instrumentation. Phase 4.
- [ ] **Realtime** — Phase 3, below.

## Phase 3 — realtime requirements

**Do this before Phase 4 analytics.** The dependency runs
`raw database → rollups/events → realtime → analytics`, not
`raw database → analytics → realtime`.

### The problem to solve

`GET /overview` currently runs ~20 live `count()` calls per request. That is
honest and fine at today's volume, and it is why the console polls at **60
seconds** and does not claim to be live. Wiring it to a 3-second refresh would
be roughly 48,000 collection scans an hour, forever, whether or not anybody has
the tab open.

The fix is not a faster poll. It is to stop recounting:

```
Spllit app  ──▶  event layer  ──┬──▶  MongoDB          (durable write)
  (a domain write)              ├──▶  MetricRollup     (incr, not recount)
                                └──▶  Socket.IO        (room: admin:metrics)
                                            │
                                            ▼
                                    admin.spllit.app
                                    (aggregates on load, deltas after)
```

Reads on page load come from cached aggregates; after that the page receives
only deltas. Polling stays as the fallback when the socket drops — which is
also what drives the "Reconnecting" state.

### Events that will need to publish

Named now so Phase 2's write paths can be instrumented in one pass later.
Everything marked *(exists)* has a write path in the codebase today; the rest
depend on features that do not exist yet.

| Event | Source | Status |
|---|---|---|
| `USER_CREATED` | `routes/auth.ts`, `usersPlatform.ts` | exists |
| `USER_SUSPENDED` / `USER_RESTORED` | `adminConsole.ts` | exists |
| `RIDE_CREATED` | `routes/rides.ts`, `ridesPlatform.ts` | exists |
| `RIDE_STATUS_CHANGED` | ride transition handler | exists |
| `MATCH_CREATED` / `MATCH_ACCEPTED` | `routes/matches.ts` | exists |
| `SQUAD_CREATED` | `routes/squads.ts` | exists |
| `SQUAD_MEMBER_JOINED` | `routes/squadsMembers.ts` | exists |
| `EVENT_CREATED` / `EVENT_CANCELLED` | `routes/events.ts`, `adminConsoleOps.ts` | exists |
| `COMMUNITY_CREATED` | `routes/communities.ts` | exists |
| `MESSAGE_SENT` | `services/live.ts` `chat:send` | exists |
| `NOTIFICATION_SENT` | `services/notifications.ts` | exists |
| `EMERGENCY_RAISED` | `routes/emergency.ts` | exists |
| `ADMIN_ACTION` | `services/auditLog.ts` `record()` | exists |
| `REPORT_CREATED` | — | needs the reporting feature |
| `POST_CREATED` / `COMMENT_CREATED` | — | no such feature in Spllit |
| `SYSTEM_ERROR` | — | needs error aggregation |

`services/auditLog.ts` `record()` is the single choke point for `ADMIN_ACTION` —
every privileged mutation already flows through it, so that one is a one-line
emit rather than an audit of every handler.

### Room security

The `admin:metrics` room must gate its join the way `services/live.ts` already
gates squad and ride rooms: against a real privilege check, resolved from the
database, never a global broadcast. That file is the pattern to copy — it
refuses a room join unless membership is proven, which is exactly the shape the
admin room needs with `resolveAdminRole` in place of membership.

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
