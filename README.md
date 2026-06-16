# TradeFlow

Job management for tradespeople — clients, scheduling, on-site time tracking,
parts & costs, employees, and emailed job cards. Built with Expo (React Native +
web) and Supabase.

## Stack

- **App:** Expo / React Native (expo-router), React 19, TypeScript — iOS, Android & web
- **Backend:** Supabase (Postgres + Row-Level Security, Auth, Edge Functions)
- **Email:** Mailtrap sending API

## Getting started

```bash
npm install
npm run dev        # start Expo
```

Create a `.env` with:

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

Edge functions also need (set via `supabase secrets set`, never in git):
`SUPABASE_SERVICE_ROLE_KEY`, `MAILTRAP_API_TOKEN`, `ALLOWED_ORIGINS`.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the Expo dev server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Jest unit tests |
| `npm run lint` | ESLint |
| `npm run build:web` | Static web export |

## Database

Migrations live in `supabase/migrations/`. Validate that the whole chain
applies cleanly from scratch (catches non-reproducible schemas):

```bash
docker compose -f db-test/docker-compose.yml up -d
./db-test/run.sh
docker compose -f db-test/docker-compose.yml down -v
```

CI (`.github/workflows/ci.yml`) runs type-check, unit tests, and the migration
chain on every push/PR.

## Roles

- **Owner** — full access: clients, jobs, calendar, team, business settings.
- **Employee** — invited staff; sees assigned jobs, tracks time, logs own costs.
