# Scripts

Seeding is intentionally skipped for the MVP.

Rationale: the API is stateless apart from Supabase (schema lives in
`supabase/migrations/`) and the configured object store (R2 or the local
filesystem). There is no local database to seed, and creating demo trips /
media would require real Supabase credentials plus uploaded objects, which
varies per environment.

To exercise the API manually:

1. Copy `apps/api/.env.example` to `apps/api/.env` and fill in `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, and `FILE_SIGNING_SECRET`.
2. `npm run dev --workspace apps/api`
3. `POST /api/trips` with an `x-session-id` header to create a trip, then use
   the returned invite code via `POST /api/trips/join/:inviteCode`.
