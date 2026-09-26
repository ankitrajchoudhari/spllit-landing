# Deploying Spllit

```
Browser
  ├── https://spllit.app          → Vercel (Next.js 16)
  ├── https://admin.spllit.app    → Cloudflare Workers (admin/, OpenNext)
  └── https://api.spllit.app      → Cloud Run, asia-south1 (Express + Socket.IO)
                                       └── MongoDB Atlas
```

**Deploying is `git push origin main`.** Three workflows in `.github/workflows/`
pick it up from there, and each one gates on the deployed thing actually
answering rather than on the publish step returning zero.

| Push to `main` | Workflow | Gate |
|---|---|---|
| anything | `deploy-backend.yml` | `/health/ready` (pings Mongo) + a Socket.IO handshake |
| anything | `deploy-frontend.yml` | `https://spllit.app/` returns 200 |
| anything | `deploy-admin.yml` | the admin origin returns 200 |

Nothing here needs local Docker. Cloud Build builds `backend/Dockerfile` in the
cloud; the two Workers build through OpenNext in CI.

> **Known inconsistency — frontend hosting.** `spllit.app` is served by Vercel,
> but `deploy-frontend.yml` publishes a Cloudflare Worker (`spllit-landing`, see
> `wrangler.jsonc`) on every push. That Worker is not on the domain, so its
> health gate — which curls `spllit.app` — is really checking Vercel's build.
> Two hosts building the same app is how a stale build hides. Pick one and
> delete the other; §2 lays out the trade.

Render, Railway, DigitalOcean and Azure were all tried and are all gone. If you
find a reference to one, it is stale — say so rather than following it.

---

## 1. Backend — Cloud Run

**Cloud Run, not Cloud Functions.** Functions are request-scoped: the instance
serving one request is not necessarily the one that served the last, and
Socket.IO keeps rooms, presence and live positions in process memory. Chat works
in testing and falls apart with two real users. Cloud Run runs the container as
a long-lived server, which is what this app already is.

A Firebase project **is** a Google Cloud project, so `spllit-app-94194` needs no
second account, console or bill.

### Routine deploys

Push to `main`. `deploy-backend.yml` runs:

```bash
gcloud run deploy spllit-api --source backend --region asia-south1 --quiet
```

No scaling, env or secret flags — deliberately. `gcloud run deploy` only changes
what it is given, so omitting them carries the live configuration forward.
Passing them would make the workflow a second source of truth that silently
overwrites console changes, and **re-specifying secrets is how a deploy drops
one** (see below).

### First-time setup, and only then

```bash
winget install -e --id Google.CloudSDK    # then open a NEW terminal
gcloud auth login

cd backend
npm run gcloud:bootstrap
```

`scripts/gcloud-bootstrap.mjs` enables the APIs, creates the Secret Manager
entries, grants the Cloud Run runtime account access to them, sets the scaling
shape, and deploys once. Run it when standing the service up or after
deliberately changing one of those things — not as a routine deploy.

To push a rotated value from `backend/.env`:

```bash
npm run gcloud:bootstrap -- --rotate
```

It compares each value against the live one first and reports `kept`,
`unchanged` or `new version pushed`, so a laptop holding a stale `.env` cannot
quietly roll a secret back.

### Why the secret flags are `--update-`, not `--set-`

`--set-secrets` and `--set-env-vars` **replace the whole set**. Anything
attached out of band — a key added from the console, a value someone else
rotated — is detached on the next run. `DATABASE_URL` went missing exactly that
way once, and the symptom was every authenticated request failing while the
health check stayed green, because the process was up and answering. That is
also why `/health/ready` exists and why CI gates on it instead of `/health`.

### Other choices worth knowing about

- **Secret Manager, not `--set-env-vars`.** `FIREBASE_PRIVATE_KEY` is a
  multi-line PEM and every shell mangles multi-line arguments differently;
  piping through stdin sidesteps quoting entirely. A corrupted key fails as
  "Invalid token" on every authenticated request — a login bug, apparently.
- **`--allow-unauthenticated`.** Requests are authenticated by the Firebase
  token in middleware, not by IAM. Without this, Cloud Run rejects them before
  Express sees them.
- **`--min-instances 0` and `--cpu-throttling`.** A cost choice, and the trade
  is real: when the last instance shuts down every open Socket.IO connection
  goes with it, and timers (Socket.IO heartbeats, the directions-cache sweep in
  `services/directions.ts`) stall between requests. `lib/live/socket.ts` sets
  `reconnection: true`, so the cost is a delay rather than a dead session.
  Change both together, or neither.
- **`--timeout 3600`.** WebSockets are HTTP requests on Cloud Run, and 60
  minutes is the ceiling. Same reconnect argument as above.

### Scaling caveat — read before raising `--max-instances`

It is **1** on purpose, and that one is a correctness bound rather than a cost
one. Socket.IO keeps connection and room state in process memory, and Cloud
Run's session affinity is explicitly best-effort, so a client's handshake and
its websocket can land on different instances. Rooms then contain only whoever
happens to share a process: presence, live positions and chat break in ways that
look intermittent, under exactly the load that triggered the scale-out.

A Socket.IO Redis adapter has to come first.

### There are no timers

The container scales to zero and CPU is throttled between requests, so nothing
scheduled inside the process can be relied on. Anything time-based is either
derived on read or swept opportunistically — see `services/squadChatRetention.ts`
for the pattern, and `/api/maintenance/*` (guarded by `MAINTENANCE_KEY`) for the
endpoints Cloud Scheduler calls.

### What the bill is made of

Audited 2026-09-26 against the September bill (₹310 net, ₹778 gross). Four
rules keep it near zero; breaking any one of them is what shows up as a charge.

- **An open socket is billed time.** Cloud Run bills an instance for as long as
  any request is open, and a websocket is one long request — min-instances 0
  does not help while a tab holds one. One idle signed-in tab left open cost
  10–15 billed hours a day on testing days. The free tier is roughly 50
  instance-hours a month at 1 vCPU. So both clients close their socket after a
  tab has been hidden for two minutes (`lib/live/socket.ts`,
  `admin/lib/live.tsx`); keep it that way for any new socket client.
- **Every secret version that is not destroyed is billed**, disabled ones
  included, and only six are free per project. Cloud Run reads `:latest`, so
  older versions have no reader: `gcloud-bootstrap.mjs --rotate` now destroys
  them once the deploy is up. The exception is `RAZORPAY_KEY_ID` /
  `RAZORPAY_KEY_SECRET` (upper-case), which the Firebase payment functions pin
  at version 1 — never destroy those.
- **Every push stores a ~200 MB image** in `cloud-run-source-deploy`; 0.5 GB
  is free. The repo has a cleanup policy (`backend/gcloud/artifact-cleanup-policy.json`):
  the 10 newest images are always kept, anything else older than 7 days is
  deleted. Rollback further back than that means rebuilding from the commit.
- **Cloud Scheduler bills per job beyond three.** There are six: five belong
  to the Firebase functions and one (`spllit-chat-erase`) to this API. Fold new
  periodic work into `/api/maintenance/sweep` rather than adding a job.

### Initialise the database, once

```bash
cd backend
DATABASE_URL="<your production URI>" npx prisma db push
```

This creates indexes for the collections (Squad, Event, Community, ChatThread,
Notification, Waitlist…). MongoDB creates the collections themselves lazily on
first write, so this is about indexes, not existence.

Logs: `npm run gcloud:logs`.

---

## 2. Frontend

`spllit.app` is on **Vercel** and serves current code. `deploy-frontend.yml`
also publishes a Cloudflare Worker built with OpenNext. Only one of these should
survive:

- **Keep Vercel** — it is what the domain points at, it is first-party for
  Next.js 16, and the move is to delete `deploy-frontend.yml`, `wrangler.jsonc`,
  `open-next.config.ts` and the `cf:build` / `deploy` / `preview` scripts.
- **Keep Cloudflare** — one vendor with the admin console and one less dashboard,
  and the move is to point the domain at the Worker, disconnect the Vercel
  project, and delete `vercel.json`.

Either is defensible. Running both is not.

### Cloudflare (OpenNext), as it stands

`npm run deploy` — not a bare `wrangler deploy`. `next build` does not produce a
Worker; OpenNext has to compile the Next server into `.open-next/worker.js`
first. And with no Cloudflare config present, wrangler detects Next.js and tries
to migrate the project itself, pulling `@opennextjs/cloudflare` through `npx`
where its `import … from 'wrangler'` cannot resolve — that is the
`Cannot find package 'wrangler'` failure. Committing `wrangler.jsonc` means the
deploy never takes that path.

CI deliberately does not use `cloudflare/wrangler-action`: it installs its own
Wrangler (3.90.0 over this project's 4.x) and `@opennextjs/cloudflare` 1.x
requires Wrangler 4, which surfaced only as a bare "Process failed with exit
code 1" inside a collapsed group.

`nodejs_compat` is set in `wrangler.jsonc` and is not optional: the Next server
uses Node built-ins a Worker does not otherwise expose.

### `vercel.json`

Vercel validates this file against a strict schema and rejects unknown
properties outright:

```
headers[0].headers[4] should NOT have additional property `comment`
```

So the header entries carry **only** `key` and `value` — there is no comment
syntax in JSON, and annotating an entry fails the build rather than being
ignored. The two header choices worth recording somewhere they survive:

- **`Cross-Origin-Opener-Policy: same-origin-allow-popups`** — not
  `same-origin`. Firebase Google Sign-In opens a popup and talks back to the
  opener; the stricter value severs that and sign-in hangs with no error.
- **`Permissions-Policy: geolocation=(self)`** — the map, live location and
  meeting-point ETAs all need it, so it cannot be denied outright.

### Environment variables

`NEXT_PUBLIC_*` values are compiled into the browser bundle, so they must exist
**in the build environment**, before the build. Setting them only in a host
dashboard does nothing for a bundle compiled in CI — that mismatch is what
produced a live site with no Mapbox token.

| Key | Value |
|---|---|
| `NEXT_PUBLIC_ENV` | `production` |
| `NEXT_PUBLIC_API_URL` | `https://api.spllit.app/api` |
| `NEXT_PUBLIC_SOCKET_URL` | `https://api.spllit.app` *(no `/api`)* |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Console → Project settings → Your apps → **Web** |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | ” |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ” |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | ” |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | ” |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | ” |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox **public** token, `pk.…` |

Optional: `NEXT_PUBLIC_DEFAULT_LNG`, `_LAT`, `_ZOOM`, `_PLACE`.

> **None of the `NEXT_PUBLIC_*` values are secret.** They ship in the JavaScript
> bundle and anyone can read them in devtools. That is expected for these keys —
> which is exactly why they must be restricted at the provider rather than
> hidden: Firebase → Authentication → Settings → **Authorized domains**, and
> Mapbox → token → **URL restrictions**.
>
> The two Mapbox tokens are not interchangeable. The browser gets `pk.…`; the
> container gets `sk.…` for Directions/ETA, so route computation never burns the
> public token's quota and the secret one never reaches a browser.

---

## 3. Admin console

`admin/` is its own npm workspace with its own lockfile and `wrangler.jsonc`,
deployed by `deploy-admin.yml` to Cloudflare Workers at `admin.spllit.app`. It
is a separate origin, which is why `server.ts` lists it explicitly in the CORS
allowlist — without that, every console request fails preflight before reaching
an auth check.

There is deliberately **no in-app path to create the first admin**; otherwise
the admin surface would be self-serve. The bootstrap is:

```bash
cd backend
node scripts/make-admin.mjs you@example.com
```

The gate in `src/middleware/requireAdmin.ts` requires all of `isActive === true`,
`adminStatus === 'active'` and an admin role — which is why editing `role` in
Atlas by hand is usually not enough. See `docs/ADMIN-CONSOLE.md`.

---

## 4. Post-deploy checklist

1. **Firebase Console → Authentication → Settings → Authorized domains → add
   every origin the site is served from** — `spllit.app` *and* `www.spllit.app`,
   plus any preview domain you actually sign in on.

   Do this first, because it is the failure that looks least like a config
   problem. Firebase refuses authentication from an origin that is not on the
   list, and it refuses it **in the browser, before any request reaches the
   API** — so Google Sign-In *and* Phone OTP both fail together, on every
   device, while `localhost` (always authorized) keeps working perfectly. It
   reads as "the site is broken", not "a domain is missing".

   Check the live list without opening the console — the key is public:

   ```bash
   curl -s "https://identitytoolkit.googleapis.com/v1/projects?key=<NEXT_PUBLIC_FIREBASE_API_KEY>"
   ```

   If `authorizedDomains` contains only `localhost` and the two
   `*.firebaseapp.com` / `*.web.app` defaults, sign-in cannot work in
   production.

2. `curl https://api.spllit.app/health/ready` → 200. **Not `/health`** — that is
   liveness only, and a deploy carrying a broken `DATABASE_URL` passed it green
   while every authenticated request was failing. Readiness pings the database.

   A connection or certificate error here, rather than an HTTP status, usually
   means the API hostname still points at whatever hosted the previous stack.
   Check DNS before debugging the service.

3. Sign in on the deployed site; confirm no CORS errors in the console. If there
   are, `FRONTEND_URL` on the Cloud Run service does not match your origin.

4. Open `/admin` and confirm the dashboard loads.

## 5. Rollback

Cloud Run keeps every revision. To go back:

```bash
gcloud run revisions list --service spllit-api --region asia-south1
gcloud run services update-traffic spllit-api --region asia-south1 --to-revisions <REVISION>=100
```

Traffic moves in seconds and no rebuild is involved, which makes this the first
thing to reach for when a deploy goes wrong — faster and safer than reverting a
commit and waiting for CI.

The pre-rebuild Vite application is preserved at the `pre-rebuild-v1` tag and
the `preserve/production-v1` branch.
