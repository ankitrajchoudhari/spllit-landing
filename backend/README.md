# Spllit API

Express + Socket.IO + Prisma, on MongoDB Atlas. Runs as a single long-lived
container on Cloud Run at `api.spllit.app`.

Deploying is `git push origin main` — see [`../DEPLOY.md`](../DEPLOY.md). This
file is about running and changing it locally.

## Running it

```bash
cd backend
npm install
cp .env.example .env      # then fill in the values below
npm run prisma:push       # creates indexes; MongoDB makes collections lazily
npm run dev               # tsx watch, http://localhost:3001
```

`npm run prisma:push`, not `prisma migrate`. Prisma's migration engine does not
support MongoDB — there is no migration history and no SQL. Additive, nullable
fields need nothing at all; `db push` is for indexes and for fields with a
required shape.

## Authentication

Firebase, verified server-side in `middleware/identity.ts`. The client sends a
Firebase ID token; the middleware verifies it against the project's public keys
and looks the account up by `firebaseUid`.

The two failures are kept apart on purpose, because they have different fixes
and got conflated once already:

- token invalid, expired or from the wrong project → **401**
- token fine, database unreachable → **503**

Returning 401 for a database outage sends everyone to the login screen, where
signing in again cannot help.

The `JWT_*` secrets still exist for the legacy `/api/auth` password routes.

## Layout

```
src/
  server.ts          route mounting, CORS, rate limits, /health
  routes/            one file per surface; admin-console/* is the operator API
  services/          the logic worth testing — email policy, retention, matching
  middleware/        identity, requireAdmin, rate limiting, perf
  utils/             prisma client, firebase admin, geo
  __tests__/         node:test, run with `npm test`
scripts/             one-off operational tools, run by hand
prisma/schema.prisma
```

## Health

| Endpoint | Answers |
|---|---|
| `/health` | the process is up. No dependencies — so the wiring tests can run without a database. |
| `/health/ready` | the process is up **and** MongoDB answers. 503 otherwise. |

CI gates deploys on `/health/ready`. A deploy carrying a broken `DATABASE_URL`
once passed a liveness check green while every authenticated request was
failing, because the process was indeed up and answering.

## There are no timers

The container scales to zero and CPU is throttled between requests, so
`setInterval` is not a thing you can rely on here. Anything time-based is either
derived when it is read or swept opportunistically on a nearby request —
`services/squadChatRetention.ts` is the reference for the pattern.

Work that must happen whether or not anyone is using the app goes behind
`/api/maintenance/*`, guarded by `MAINTENANCE_KEY`, and is called by Cloud
Scheduler. Without that key the routes 404, so an install that has not set one
up is inert rather than open.

## Scripts

```bash
npm test                 # node:test, src/__tests__/*.test.ts
npm run build            # prisma generate && tsc
npm run gcloud:logs      # tail Cloud Run

node scripts/make-admin.mjs you@example.com        # the admin bootstrap
node scripts/audit-user-active.mjs                 # report on isActive; --fix to repair
node scripts/diagnose-ride-visibility.mjs <id>     # why can't this person see that squad
```

`scripts/gcloud-bootstrap.mjs` provisions the Cloud Run service and its Secret
Manager entries. It is **not** the deploy — see `../DEPLOY.md`.

## Environment

Required. Without these the container starts and then fails every real request,
which is worse than refusing to start:

```env
DATABASE_URL=mongodb+srv://...
JWT_SECRET=
JWT_REFRESH_SECRET=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
MAPBOX_SECRET_TOKEN=sk....
```

Optional, each degrading one feature rather than breaking the app:

```env
RESEND_API_KEY=            # transactional email; see docs/EMAIL-SYSTEM.md
RESEND_WEBHOOK_SECRET=     # delivery webhooks, Svix-signed
CAMPAIGN_EMAIL_FROM=       # must be a separate sending domain from transactional
MAINTENANCE_KEY=           # /api/maintenance/*
RAZORPAY_KEY_ID=           # the squad join fee; endpoints answer 503 without it
RAZORPAY_KEY_SECRET=
OPENAI_API_KEY=            # /api/ai
```

`MAPBOX_SECRET_TOKEN` is the `sk.…` token and is not interchangeable with the
browser's `pk.…` one: route computation server-side must not burn the public
token's quota, and the secret token must never reach a browser.

## Security notes

- Phone numbers are hashed before storage.
- Rate limits are two-tier: a global per-client budget protecting the single
  container, and a far tighter one on `/api/auth`, because those endpoints mint
  credentials and 600 guesses in a quarter hour is a working brute-force attempt.
- Security headers are written by hand rather than pulling in helmet — this
  serves JSON, so most of helmet's surface either does not apply or belongs at
  the edge.
- There is no in-app path to create the first admin, by design. Use
  `scripts/make-admin.mjs`.
- The Resend webhook route is mounted **before** `express.json`, and that
  ordering is load-bearing: the Svix signature covers the exact bytes sent, and
  a parsed body cannot be turned back into them.

## Troubleshooting

**"Invalid token" on every authenticated request** — usually a mangled
`FIREBASE_PRIVATE_KEY`. It is a multi-line PEM, and shells mangle multi-line
values differently. `utils/firebaseAdmin.ts` normalises it; the bootstrap script
cleans it before upload so what is stored is the key and nothing else.

**Socket.IO drops** — expected while `--min-instances` is 0. The last instance
shutting down takes every open connection with it. The client reconnects.

**Prisma client out of date after a schema edit** — `npm run prisma:generate`.
`postinstall` runs it too.
