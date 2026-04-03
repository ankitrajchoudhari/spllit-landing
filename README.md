# Spllit - Ride Sharing Platform

A React + Vite application for shared ride booking and management.

## 🛡️ Environment Variables Setup (IMPORTANT - READ FIRST!)

### ⚠️ SECURITY RULES - NEVER BREAK THESE:
1. ✅ **Store real secrets in `.env.local` ONLY** (never commit)
2. ✅ **`.env.local` is in `.gitignore`** - it will NEVER be committed to git
3. ✅ **Use `.env.example` for placeholder values** (safe to commit)
4. ✅ **Never push API keys, tokens, or credentials to GitHub**

### Setup for Local Development:

```bash
# 1. Copy the example file
cp .env.example .env.local

# 2. Edit .env.local and add YOUR real secrets:
nano .env.local
# OR
code .env.local

# 3. Add your Google API credentials:
VITE_GOOGLE_MAPS_API_KEY=your_real_api_key_here
VITE_GOOGLE_CLIENT_ID=your_real_client_id_here
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
```

### Setup for Production (Render/Railway):

1. **Never create a `.env` file in production**
2. **Add secrets via dashboard instead:**
   - Render.com: Dashboard → Environment
   - Railway.app: Variables section
   - These are encrypted and never visible in code

### Verify Secrets Are Safe:

```bash
# Check that .env.local is properly ignored:
git check-ignore -v .env.local
# Should output: .gitignore:29:.env*.local

# Verify nothing secret was committed:
git log --all --oneline -- '.env.local'
# Should output nothing (empty)
```

## 🚀 Getting Started

### Prerequisites
- Node.js 16+
- npm or yarn
- Google Maps & OAuth credentials

### Installation

```bash
# Install dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..

# Start backend (in one terminal)
cd backend && npm run dev

# Start frontend (in another terminal)
npm run dev
```

## 📚 Tech Stack

- **Frontend:** React 18 + Vite, Zustand (state management), React Router, Framer Motion
- **Backend:** Node.js/Express, Prisma ORM, JWT authentication, Socket.io
- **Database:** PostgreSQL (via Prisma)
- **APIs:** Google Maps API, Google OAuth 2.0

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

