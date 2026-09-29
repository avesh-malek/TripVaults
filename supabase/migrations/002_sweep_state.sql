-- TripVault migration: 002_sweep_state.sql
--
-- Lazy expiration-sweep coordination for serverless deployments (Vercel has
-- no always-on process, so node-cron cannot run there). The API's
-- lazyExpirationSweep middleware claims the hourly sweep by atomically
-- updating this single row:
--   UPDATE sweep_state
--   SET last_run_at = now()
--   WHERE id = 1
--     AND (last_run_at IS NULL OR last_run_at < now() - interval '1 hour');
-- The row is inserted first if missing. Only one claimant gets a row back,
-- so at most one instance per hour runs the sweep.

create table if not exists public.sweep_state (
  id integer primary key default 1,
  last_run_at timestamptz
);

insert into public.sweep_state (id) values (1) on conflict (id) do nothing;

alter table public.sweep_state enable row level security;

comment on table public.sweep_state is
  'TripVault lazy sweep coordination. Single row (id = 1); backend claims the hourly expiration sweep with an atomic conditional UPDATE using the service_role key which bypasses RLS.';
