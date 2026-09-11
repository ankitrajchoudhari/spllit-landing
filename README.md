# Spllit

A location-based community platform. Phase 1 leads with **Ride Together** and
**Squads**; Events and Communities ship alongside them, and Rentals, Bill
Splitting and Marketplace are present in the information architecture as
waitlist surfaces.

## Architecture

```
Next.js 16 (App Router, strict TS)   ← this repo, /app /components /lib
   spllit.app, on Vercel
        │  HTTPS (React Query)  │  WebSocket (Socket.IO)
        └────────────┬────────────┘
                     ▼
  Express + Socket.IO on Cloud Run   ← backend/
        api.spllit.app
                     │
                     ▼
              MongoDB (Prisma)

  admin.spllit.app — Cloudflare Workers   ← admin/
        talks to the same API
```

**Firebase is the identity provider only** — Google Sign-In and Phone OTP.
There is no Firestore, no Realtime Database and no Cloud Functions: all
application data lives in MongoDB behind the Express API, and the live layer
(positions, presence, typing) runs over Socket.IO rooms.

## Layout

| Path | What lives there |
| --- | --- |
| `app/` | Routes. `app/(app)/` is the authenticated shell; `app/page.tsx` is the landing page; `app/auth/` is the one-time onboarding flow. |
| `components/ui/` | Design-system primitives. One component per recurring pattern. |
| `components/map/` | `SplitMap` and its marker/preview/layer chrome. |
| `lib/services/` | The only modules that talk to the API. |
| `lib/hooks/queries.ts` | React Query hooks. Components call these, never services directly. |
| `lib/map/` | Shared map config, layer registry, domain→marker adapters. |
| `lib/live/` | Socket.IO client and live-data hooks. |
| `types/` | Domain types, mirroring `backend/prisma/schema.prisma`. |
| `backend/` | Express API, Prisma schema, operational scripts. |

Data flow is one-directional: **component → hook → service → API**. Components
never call `fetch` or the API client themselves.

## Running it

```bash
cp .env.example .env.local     # fill in Firebase + Mapbox + API URLs
npm install
npm run dev                    # http://localhost:3000

cd backend
cp .env.example .env           # DATABASE_URL, JWT secrets, Firebase Admin
npm install
npx prisma db push
npm run dev                    # http://localhost:3001
```

## Environment variables

Real secrets live in `.env.local` (web) and `backend/.env` — both are
gitignored and must never be committed. `.env.example` holds placeholders only.
Every value is read through `lib/config.ts`; nothing in the app reads
`process.env` directly, and no key or project id is hardcoded in source.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit`, strict |
| `npm run lint` | ESLint |

## Conventions

- **No hardcoded data.** Every list, count and marker comes from the API. Static
  UI copy lives in `content/`.
- **Design tokens only.** Colours, radii and spacing come from
  `tailwind.config.ts` and the CSS variables in `app/globals.css`. No inline hex.
- **Every data-bearing section** has a skeleton that matches its final
  dimensions, an empty state and an error state. Sections load independently.
- **The map is one component.** `/map`, ride detail, squad detail and event
  detail all render `<MapCanvas />` with a different `mode` and `layers`.
- **Authorisation is server-side.** Hiding a control in the UI is presentation;
  the check that matters lives in the route handler.

## History

The pre-rebuild Vite/React application is preserved at the `pre-rebuild-v1` tag
and the `preserve/production-v1` branch.
