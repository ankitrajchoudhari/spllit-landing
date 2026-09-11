# Migration Report — Engineering Baseline

Snapshot taken 2026-08-07, before any Firestore work begins. This is the
reference point the Firestore user migration is measured against.

> **Superseded in one respect, kept as written.** The Cloudflare Worker in
> front of the container (`backend/edge/worker.ts`, `backend/wrangler.jsonc`)
> was removed on 2026-09-12: response headers showed `api.spllit.app` resolving
> to Cloud Run, with Cloudflare acting only as a proxy, so the Worker was a
> second deployment of the same Express app that nothing reached. §1 and §9
> below describe the architecture as it was on the snapshot date. Everything
> else still holds. Current architecture: `DEPLOY.md`.

Every number here was measured against the working tree, not estimated. Where a
requested section describes something that does not exist, it says so — an
absent subsystem is a finding, not a gap in the report.

---

## 1. Current backend architecture

```
Browser (Next.js 16 / React 19)
   │  Firebase ID token in Authorization: Bearer
   ▼
Cloudflare Worker  (backend/edge/worker.ts)
   │  blind pass-through: getContainer(env.BACKEND).fetch(request)
   ▼
Express 4 container  (backend/src/server.ts)   ← capped at 1 instance for Socket.IO
   ├── 24 route modules under /api/*
   ├── Socket.IO server (same HTTP server)
   └── Prisma 6 client
          ▼
      MongoDB Atlas
```

- **Runtime:** Node + Express 4, ESM (`"type": "module"`), TypeScript 5.7.
- **ORM:** Prisma 6 with `provider = "mongodb"`.
- **Realtime:** Socket.IO attached to the same HTTP server. The container is
  capped at one instance because Socket.IO holds in-process state.
- **Edge:** a Cloudflare Worker that forwards every request unmodified. It
  contains no routing, auth, or caching logic.
- **Frontend:** Next.js App Router, TanStack Query, Zustand, deployed on Vercel.

## 2. Current authentication flow

Two schemes coexist and resolve to the same `req.user`:

```
Web:     Firebase ID token  ──┐
                              ├──▶  identify()  ──▶  req.user = { userId, email }
Legacy:  backend JWT      ────┘
```

- `middleware/identity.ts` → `identify` tries the backend JWT first (cheap local
  signature), then falls back to verifying a Firebase ID token via firebase-admin.
  On Firebase success it resolves to a local user by `firebaseUid`, then `email`
  — the email fallback lets pre-Firebase accounts adopt a uid instead of forking
  a duplicate. No local profile ⇒ `404 { code: 'no-profile' }`, which the client
  reads as "run onboarding".
- `middleware/auth.ts` → `authenticate` verifies the **backend JWT only**. Used
  by legacy routers. This is what broke `GET /users/:id` for web callers.
- `middleware/requireAdmin.ts` gates the platform admin surface.
- Sign-in itself is client-side Firebase (Google popup/redirect, Phone OTP with
  `RecaptchaVerifier`). The backend never issues a session for web; it verifies
  a token per request.
- Onboarding is gated by `User.onboarded`, set once username + college exist.

**Identity join key today:** `User.id` (Mongo `_id`, a cuid). `firebaseUid` is a
nullable secondary field with a *sparse* unique index (declared in
`prisma/indexes.mjs`, not `@unique` — MongoDB treats every null in a plain unique
index as the same value).

## 3. Current Firestore collections

**None.** There is no Firestore usage anywhere in the codebase.

- `lib/firebase.ts` initialises Auth only — no `getFirestore`.
- `backend/src/utils/firebaseAdmin.ts` verifies ID tokens only — no Firestore.
- No `firestore.rules`, no `firebase.json`, no indexes file.

Firebase is currently an **identity provider only**. The Firestore migration is
therefore a greenfield build on the Firebase side, not a schema change.

## 4. Current Prisma schema

31 models against MongoDB. `User` is the hub:

| Model | Relation to `User` |
|---|---|
| `Ride` | `creator` (`RideCreator`) |
| `TripRequest` | `user` |
| `Match` | `user1`, `user2` |
| `Message` | `sender` |
| `Location` | `user` |
| `Block` | `blocker`, `blocked` |
| `Emergency` | `user` |
| `HostProfile` | `user` (1:1) |

That is **9 relation edges** enforced at the database level by Prisma.

Models with no `User` relation (they carry loose ids or none): `Squad`,
`SquadMember`, `Event`, `EventAttendee`, `Community`, `CommunityMember`,
`Channel`, `ChatThread`, `ThreadMessage`, `ThreadReadState`, `Notification`,
`Waitlist`, `RentalListing`, `MarketplaceListing`, `Transaction`, `Vehicle`,
`RideAnnouncement`, `Announcement`, `Admin`, `EarlyAccess`, `MailProvider`,
`AutomationMail`.

Relevant `User` fields for the migration: `id`, `firebaseUid`, `username`,
`email`, `phone`, `phoneHash`, `instituteId`, `instituteEmail`,
`instituteVerified`, `onboarded`, `rating`, `totalRides`, `fcmTokens[]`,
`homeLat/homeLng/homeCity`, `services` (Json), `role`, `isAdmin`.

## 5. Current RTDB structure

**None.** No Realtime Database usage. Live location and presence run over
Socket.IO instead:

| Channel | Events |
|---|---|
| client → server | `join_matches`, `send_message`, `mark_read`, `typing`, `share_location`, `stop_location`, `disconnect` |
| server → client | `new_message`, `message_read`, `user_status`, `location_update` |

Rooms are keyed by `match.chatRoomId`.

## 6. Active API routes

14 route modules carry live traffic. All are mounted under `/api`.

| Module | Mount | Notes |
|---|---|---|
| `ridesPlatform.ts` | `/rides` | 11 endpoints, all called |
| `usersPlatform.ts` | `/users` | 8 endpoints + migrated `GET /:id` |
| `squads.ts` | `/squads` | Deliberate split with `squadsMembers.ts` |
| `squadsMembers.ts` | `/squads` | Mounted first; both are live |
| `host.ts` | `/host` | |
| `trips.ts` | `/trips` | |
| `chat.ts` | `/chat` | |
| `communities.ts` | `/communities` | |
| `events.ts` | `/events` | |
| `notifications.ts` | `/notifications` | |
| `search.ts` | `/search` | |
| `publicData.ts` | `/public` | Unauthenticated |
| `waitlist.ts` | `/waitlist` | |
| `adminPlatform.ts` | `/admin-panel` | Admin-gated |

## 7. Deprecated API routes

10 modules, all INSTRUMENTED as of 2026-08-07 and awaiting runtime evidence.
See `docs/DEPRECATION-POLICY.md`.

| Module | Mount | Replacement | Web traffic |
|---|---|---|---|
| `auth.ts` | `/auth` | Firebase SDK + `/users/me/bootstrap` | none |
| `users.ts` | `/users` | `usersPlatform.ts` | none (`/:id` migrated out) |
| `rides.ts` | `/rides` | `ridesPlatform.ts` | none |
| `admin.ts` | `/admin` | `adminPlatform.ts` | none |
| `matches.ts` | `/matches` | rides + chat | none |
| `emergency.ts` | `/emergency` | — | none |
| `announcements.ts` | `/announcements` | — | none |
| `subadmin.ts` | `/subadmin` | — | none |
| `earlyAccess.ts` | `/early-access` | — | none |
| `automation.ts` | `/automation` | — | none |

**Mount-order shadowing.** `/api/rides` and `/api/users` each host a platform
router mounted *before* a legacy one. Express first-match-wins means the legacy
`POST /rides/` and `GET /rides/search` are unreachable, while `/rides/announcements`,
`/rides/available`, `/rides/my`, `PUT /rides/:id` and `DELETE /rides/:id` still
resolve. This is why "the file is legacy" and "the endpoint is dead" are not the
same statement here.

## 8. Shared services

`backend/src/services/`:

| Service | Responsibility | Touches `User` |
|---|---|---|
| `socket.ts` | Socket.IO handlers, rooms, presence | yes (1 join) |
| `live.ts` | In-memory live positions | via ids |
| `corridor.ts` | Route-corridor matching | no |
| `directions.ts` | Mapbox directions | no |
| `squads.ts` | Squad domain logic | via ids |
| `threads.ts` | Chat thread resolution | via ids |
| `notifications.ts` | Notification fan-out | via ids |
| `emailService.ts` | Nodemailer transport | no |
| `aiService.ts` | OpenAI calls | no |
| `csvService.ts` | CSV import/export | no |
| `testmail.ts` | Test-mail verification | no |

`backend/src/utils/`: `prisma.ts` (client singleton), `firebaseAdmin.ts` (token
verification), `helpers.ts` (JWT sign/verify, `hashPhone`, `sanitizeUser`),
`respond.ts` (`ok`/`fail` envelope, `guard`, `boundingBox`).

`backend/src/middleware/`: `identity.ts`, `auth.ts`, `requireAdmin.ts`,
`perf.ts`, `deprecation.ts`.

## 9. Cloud Functions

**None.** No `functions/` directory, no `firebase.json`, no deployed callable or
trigger functions.

The only edge compute is `backend/edge/worker.ts`, a Cloudflare Worker that
forwards requests to the container without inspecting them.

## 10. Security rules

**No Firestore or Storage security rules exist**, because neither product is in
use. Authorisation today is entirely application-level:

- `identify` / `authenticate` establish identity per request.
- `requireAdmin` gates the admin surface.
- CORS allowlist in `server.ts`: `spllit.app`, `www.spllit.app`, `FRONTEND_URL`,
  and any `*.vercel.app` preview.
- **Requests with no `Origin` header are allowed** (`if (!origin) return true`),
  deliberately, so native clients can call the API.

Writing Firestore security rules is net-new work with no existing baseline to
port. It is a prerequisite for the migration, not a follow-up.

## 11. Technical debt

| Item | Evidence | Severity |
|---|---|---|
| Two auth middlewares with different capabilities | `authenticate` (JWT only) vs `identify` (JWT + Firebase). Caused a live 401 bug on `/profile/[userId]` | High — one fixed, pattern remains |
| Two response envelopes | Legacy `{ user }` / `{ error }` vs platform `{ success, data }` | Medium — frozen for mobile compatibility |
| Mount-order shadowing | Legacy routers reachable only for non-overlapping paths | Medium — fragile, order-dependent |
| Duplicate admin surfaces | `admin.ts` + `subadmin.ts` vs `adminPlatform.ts` | Medium |
| 9 root-level maintenance scripts | `backend/*.mjs`, direct Prisma access, no auth | Medium — will break on Prisma `User` removal |
| `sanitizeUser` vs `PROFILE_FIELDS` vs `PUBLIC_PROFILE_FIELDS` | Three overlapping definitions of "safe user fields" | Medium |
| `backend/README.md` documents deleted-UI endpoints | Documents `/api/auth/*`, `/api/matches/*`, `/api/rides/my` | Low |
| No CI | No `.github/workflows`; tests run manually | Medium |
| Uncommitted rewrite | ~150 files including all platform routers | High — see §14 |

## 12. Breaking changes required for the Firestore migration

Measured, not estimated:

| Change | Count | Location |
|---|---|---|
| Prisma relation edges to delete | 9 | `schema.prisma` |
| `prisma.user.*` call sites to rewrite | ~110 (≈70 after legacy deletion) | 25 files |
| Cross-model `include`/`select` joins that cannot survive | 26 (25 in deprecated routers, 1 in `socket.ts`) | `matches.ts` 14, `admin.ts` 5, `rides.ts` 4, `emergency.ts` 2, `socket.ts` 1 |
| Maintenance scripts reading `prisma.user` | 9 | `backend/*.mjs`, `backend/scripts/` |
| Sparse unique indexes to reimplement | 2 (`firebaseUid`, `username`) | `prisma/indexes.mjs` |

Structural consequences:

1. **Canonical id changes** from `User.id` (cuid) to Firebase Auth UID. Every
   `userId` field in every other model is a foreign key to the old id. Either
   they are rewritten to uids, or a permanent id-mapping layer exists — the
   latter is a second authoritative store and is ruled out.
2. **Referential integrity becomes application-level.** MongoDB will no longer
   reject a `Ride` whose creator does not exist.
3. **Joins become fan-out reads.** Any list view showing creator name/photo
   turns into N+1 unless it reads the denormalized snapshot.
4. **Username uniqueness** currently rests on a sparse unique index. Firestore
   has no unique constraint — it needs a separate `usernames/{username}` doc
   written in a transaction.
5. **Uniqueness of `phoneHash` and `email`** has the same problem.
6. **Socket.IO auth** resolves a Mongo user per connection; it must resolve a
   Firestore doc instead.

## 13. Rollback strategy

The migration's risk is asymmetric: writes that land in Firestore while Mongo is
still authoritative are the hard case, so the cutover must be one-directional
and reversible only *before* it happens.

| Stage | Rollback |
|---|---|
| Firestore schema + rules deployed, nothing reading | Delete the collections. No impact |
| Backfill Mongo → Firestore, Mongo still authoritative | Re-run backfill; Firestore is derived and disposable |
| Reads cut over to Firestore, writes still Mongo | Revert the read path. Firestore stays derived |
| **Writes cut over to Firestore** | **Point of no return.** Reverting means replaying Firestore writes back into Mongo |
| Prisma `User` deleted | Revert requires restoring the model *and* backfilling from Firestore |

Requirements before the write cutover:
- A verified Mongo `users` snapshot, restorable independently.
- The backfill script must be idempotent and re-runnable.
- Read cutover ships and soaks separately from write cutover — never one release.
- A feature flag that flips the read path back without a deploy.

## 14. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A deprecated route is deleted while Flutter still calls it | Medium | High — silent 404s on live clients | Instrumentation is live; deletion blocked on runtime evidence |
| Uncommitted rewrite (~150 files) is lost or partially applied | Medium | High | Commit the rewrite as a baseline before migration work |
| Username/email/phone uniqueness races under Firestore | High | High | Transactional uniqueness docs, written before any signup traffic |
| Denormalized snapshots drift from source | High | Medium | Accepted by policy: historical docs are immutable; live views read the user doc |
| N+1 read amplification on list views | High | Medium | Snapshot fields on new documents only |
| Id remapping leaves orphaned references | Medium | High | Migrate ids in one pass; never keep a mapping table long-term |
| No CI to catch regressions | High | Medium | Wire `npm test` + `tsc --noEmit` before the migration |
| Maintenance scripts break silently on `User` removal | High | Low | Inventory in §8; rewrite or delete with the model |
| Socket.IO single-instance cap | Low | Medium | Unchanged by this migration; do not scale out |

## 15. Estimated implementation order

Ordered by dependency, not by effort. Each stage is independently shippable.

| # | Stage | Depends on | Blocked by |
|---|---|---|---|
| 0 | Commit the rewrite baseline + this session's cleanup | — | User decision |
| 1 | **Phase 1 SRS written and approved** | — | **Not yet provided** |
| 2 | Collect deprecation runtime evidence (one client release cycle) | Instrumentation (done) | Time |
| 3 | Delete legacy routers proven uncalled | 2 | Evidence |
| 4 | Wire CI (`tsc --noEmit`, `npm test`) | — | — |
| 5 | Design Firestore `users` schema + security rules | 1 | SRS |
| 6 | Transactional uniqueness docs (username, email, phoneHash) | 5 | — |
| 7 | Idempotent backfill Mongo → Firestore | 5, 6 | — |
| 8 | Read cutover behind a flag; soak | 7 | — |
| 9 | Write cutover (point of no return) | 8 | Verified snapshot |
| 10 | Rewrite 9 relation edges to uid references | 9 | — |
| 11 | Rewrite the 26 cross-model joins (≈1 after stage 3) | 3, 10 | — |
| 12 | Delete Prisma `User`, update scripts and indexes | 10, 11 | — |
| 13 | Migrate Socket.IO identity resolution | 9 | — |

Stage 3 before stage 11 matters: 25 of the 26 joins live in routers that are
already candidates for deletion. Migrating them first would be wasted work.

---

## Open questions for the SRS

These are undefined today and change the implementation materially:

1. Does the Firebase UID replace `User.id` everywhere, or does the Firestore doc
   keep its own id with uid as a field?
2. What is authoritative for `role` / `isAdmin` — a Firestore field, or custom
   claims on the Firebase token?
3. Do the 9 maintenance scripts survive? Several manage admin accounts that the
   rewrite's UI no longer exposes.
4. Does the Flutter app migrate to Firestore reads directly, or keep calling the
   Express API?
5. What happens to `Match`, `Message` and `Location` — they belong to the legacy
   matching system that `rides` + `chat` superseded.
