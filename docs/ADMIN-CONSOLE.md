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

`identify` + `requireConsoleAdmin` are applied once at the router level so a new
handler cannot ship ungated by someone forgetting to repeat them.

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

**Phase 1 — foundation: done.** Verified: backend `tsc` clean + 155 tests pass;
admin app builds (7 routes) and lints clean; main app `tsc` clean, lints clean,
150 tests pass.

Built:

- [x] Five-role RBAC with permission matrix and legacy fallback
- [x] Server-side authorisation on every route; no frontend-only checks
- [x] Audit log — successes and failures, reasons required, PII redacted
- [x] Separate app, own Worker, own config, dark Spllit-token UI
- [x] Sign-in, session guard, sidebar, loading/empty/error/permission states
- [x] Dashboard, Users (paginated + filtered), Audit, Flags, Admins, System

Not built, and why:

- [ ] **Moderation** — Spllit has no `Report` model and no way for a user to
      report anyone. Needs product work in the main app first, which was out of
      scope for this pass. The nav shows it as unavailable rather than empty.
- [ ] **Posts/comments** — Spllit has no such feature. Not applicable.
- [ ] **Analytics** — needs `AnalyticsEvent` + instrumentation. Phase 5.
- [ ] **Realtime** — Socket.IO already exists and is well built
      (`backend/src/services/live.ts`); the console needs an `admin:metrics`
      room and rollup counters. Phase 4. Until then the dashboard polls at 60s
      and does not pretend to be live.

### Next

**Phase 4 before Phase 5.** `/overview` currently runs ~20 live `count()` calls
per request. That is honest at today's volume, but it is the thing that must not
be wired to a fast refresh — a `MetricRollup` model with incremental counters on
domain writes is the only affordable version of the 3-second target.

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
