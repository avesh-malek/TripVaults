# TripVault

Temporary shared media galleries for trips and events. Create a trip, get an
invite code, everyone drops photos and videos into one gallery — and the whole
thing (plus its files) self-destructs on a schedule you choose.

```
┌──────────────┐        ┌───────────────────────────────┐        ┌──────────────┐
│   apps/web   │───────▶│            apps/api           │───────▶│   Supabase   │
│  (frontend)  │        │  (Express/Fastify REST API)   │        │  (Postgres)  │
└──────────────┘        └───────────────┬───────────────┘        └──────────────┘
        ▲                               │                                ▲
        │   both import @tripvault/shared: types, zod schemas,          │
        │   constants, API DTOs — one contract, zero drift                │
        └───────────────────────────────┼────────────────────────────────┘
                                        ▼
                              Object storage (R2/S3
                              or local ./storage)
```

## Repo layout

| Path | What |
|---|---|
| `apps/api/` | REST API backend |
| `apps/web/` | Frontend web app |
| `packages/shared/` | `@tripvault/shared` — domain types, zod schemas, constants, API DTOs |
| `supabase/migrations/` | Database migrations |

## Prerequisites

- Node.js 20+
- A Supabase project (database only; the API uses the service-role key)
- Optional: Cloudflare R2 or S3-compatible storage for media.
  Without it, the API falls back to **local storage mode** and needs zero
  credentials.

## Setup

```bash
npm install

# Apply the database migration (see supabase/README.md):
supabase db push
# …or paste supabase/migrations/001_initial.sql into the Supabase SQL editor.

# Configure the API — copy the example and fill in your keys:
cp apps/api/.env.example apps/api/.env

# Configure the web app (optional — defaults to http://localhost:4000/api):
cp apps/web/.env.example apps/web/.env

# Start everything:
npm run dev:api   # API on :4000 (tsx watch mode)
npm run dev:web   # web app on :5173 (Vite dev server)

# Production-style run:
npm run build
PORT=4000 node apps/api/dist/index.js
```

> Note: `@tripvault/shared` compiles to ESM (`packages/shared/dist`) and is
> built first — the root `npm run build` already handles the order
> (shared → api → web).

## Local storage mode

If no storage credentials are configured, the API writes uploads to
`./storage/` (gitignored) and serves files itself. Everything works
end-to-end with zero cloud setup; plug in R2 later by setting the storage
env vars in `apps/api/.env`.

## Scripts

| Script | What it does |
|---|---|
| `npm install` | Install deps for all workspaces |
| `npm run build` | Build every workspace |
| `npm run typecheck` | Typecheck every workspace |
| `npm run dev:api` | Start the API in watch mode |
| `npm run dev:web` | Start the web app in watch mode |
