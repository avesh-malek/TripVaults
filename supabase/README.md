# Supabase setup

The database lives in `migrations/`. Two ways to apply it.

## Option A — Supabase CLI

```bash
# once per machine
npm i -g supabase

# link your project (creates supabase/config.toml entry)
supabase link --project-ref <your-project-ref>

# apply pending migrations
supabase db push
```

## Option B — SQL editor

1. Open your project's **SQL Editor** in the Supabase dashboard.
2. Paste the contents of `migrations/001_initial.sql`.
3. Run it.

Both options create the `trips`, `trip_members`, `join_requests` and
`media` tables with RLS enabled (see the comment at the top of the
migration for why the backend uses the service-role key).

## Adding a migration

Name it `002_<what_changed>.sql`, keep it idempotent where reasonable,
and push it with `supabase db push`.
