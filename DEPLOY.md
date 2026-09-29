# Deploying TripVault

TripVault has two deployables:

| Piece | What | Where (recommended) |
|---|---|---|
| API | `apps/api` (Dockerfile) | Railway or Render |
| Web | `apps/web` (static Vite build) | Vercel |

Plus: a **Supabase** project (Postgres) and file storage (Cloudflare **R2** for
production, or the API server's local disk for a demo).

## 0. Prerequisites

- The repo pushed to GitHub (or available to the host via CLI).
- A Supabase project. Create one at https://supabase.com (free tier is fine).

## 1. Database — Supabase

1. Open your Supabase project → **SQL Editor** → paste the contents of
   `supabase/migrations/001_initial.sql` → **Run**. This creates the
   `trips`, `trip_members`, `join_requests`, and `media` tables.
2. Copy two values for later:
   - **Project URL**: Project Settings → Data API → `SUPABASE_URL`
     (e.g. `https://xyzcompany.supabase.co`)
   - **service_role key**: Project Settings → API Keys → `service_role`
     (**secret** — never expose it to the browser; the API uses it server-side
     and it bypasses RLS).

## 2. API — Railway (recommended) or Render

### Railway

1. https://railway.app → **New Project → Deploy from GitHub repo** → select this repo.
2. In the service settings, set the **Dockerfile path** to `apps/api/Dockerfile`
   (Railway auto-detects Dockerfiles; if it picks wrong, override it).
3. **Generate Domain** under Settings → Networking to get a public URL,
   e.g. `https://tripvault-api.up.railway.app`.
4. Add a **volume** mounted at `/app/storage` (only needed for
   `STORAGE_PROVIDER=local`; skip if using R2).
5. Set environment variables (Variables tab):

| Variable | Value |
|---|---|
| `SUPABASE_URL` | from step 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | from step 1 (mark secret) |
| `API_PUBLIC_URL` | your Railway domain, e.g. `https://tripvault-api.up.railway.app` |
| `CORS_ORIGIN` | your Vercel URL from step 3 (update after deploying web) |
| `STORAGE_PROVIDER` | `local` (demo) or `r2` (production) |
| `FILE_SIGNING_SECRET` | `openssl rand -hex 32` output |
| `STORAGE_LOCAL_DIR` | `/app/storage` (must match the volume mount) |
| `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | only for `r2` |

   Railway injects `PORT` automatically — the API honors it.

### Render (alternative)

1. https://render.com → **New → Web Service** → select the repo.
2. Runtime: **Docker**, Dockerfile Path: `./apps/api/Dockerfile`,
   Health Check Path: `/api/health`.
3. Add the same env vars as above. Under **Disks**, add a 1 GB disk mounted
   at `/app/storage` if using `local` storage (note: the free tier has
   ephemeral disks — uploads are lost on redeploy; use R2 for anything real).

## 3. Web — Vercel

1. https://vercel.com → **Add New → Project** → import the repo.
2. Keep **Root Directory** as the repository root — `vercel.json` already
   declares the build command, output directory (`apps/web/dist`), and the
   SPA rewrites for React Router.
3. Environment variables:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `<your API domain>/api`, e.g. `https://tripvault-api.up.railway.app/api` |

   ⚠️ `VITE_*` vars are baked in at **build** time — redeploy after changing them.

4. Deploy. You'll get e.g. `https://tripvault.vercel.app`.
5. Go back to the API service and set `CORS_ORIGIN` to that URL, then
   redeploy/restart the API.

## 4. Smoke test

1. Open the web URL → **Create a Trip** → copy the invite link.
2. Open the invite link in an incognito window → join with a different name.
3. Upload a photo from each session → check the gallery shows thumbnails.
4. Click a photo → preview → **Download Original**.
5. Select several → **Download Selected** (ZIP).
6. Owner: open **Members** → approve/remove; **Settings** → extend/close trip.
7. API health: `GET <api-domain>/api/health` should return `{ "ok": true }`.

## Notes

- **Storage**: `local` is zero-setup and perfect for trying the product, but
  files live on the API server's disk. For production, create a Cloudflare R2
  bucket + API token and switch `STORAGE_PROVIDER=r2` (see
  `apps/api/.env.example`).
- **Expiration**: the API runs an hourly job that transitions trips
  `active → expiring_soon → expired → grace_period → deleted` and purges
  storage. No scheduler setup needed on the host.
- **Security**: the service_role key and `FILE_SIGNING_SECRET` stay
  server-side. The browser only ever sees short-lived signed URLs.
