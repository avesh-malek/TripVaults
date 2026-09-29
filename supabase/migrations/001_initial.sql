-- TripVault initial schema: 001_initial.sql
--
-- Tables: trips, trip_members, join_requests, media.
--
-- Row Level Security is enabled on every table. The TripVault API backend
-- talks to Postgres with the **service_role** key, which bypasses RLS
-- entirely; all access control is enforced in application logic. RLS is
-- enabled anyway as defence in depth so no anon/authenticated key can ever
-- read or write these tables by accident.

-- Needed for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- trips
-- ---------------------------------------------------------------------------
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_member_id uuid,
  invite_code text not null unique,
  access_type text not null check (access_type in ('open', 'approval')),
  expires_at timestamptz not null,
  status text not null default 'active'
    check (status in ('active', 'expiring_soon', 'expired', 'grace_period', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trips_invite_code_idx on public.trips (invite_code);

-- ---------------------------------------------------------------------------
-- trip_members
-- ---------------------------------------------------------------------------
create table public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null,
  session_id text not null,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  status text not null default 'active'
    check (status in ('active', 'left', 'removed')),
  unique (trip_id, session_id)
);

create index trip_members_trip_id_idx on public.trip_members (trip_id);

-- ---------------------------------------------------------------------------
-- join_requests
-- ---------------------------------------------------------------------------
create table public.join_requests (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null,
  session_id text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

-- Only one *pending* request per session per trip at a time; a rejected
-- visitor may request again, an approved one becomes a member instead.
create unique index join_requests_pending_unique
  on public.join_requests (trip_id, session_id)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- media
-- ---------------------------------------------------------------------------
create table public.media (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  uploaded_by uuid not null references public.trip_members (id) on delete cascade,
  original_name text not null,
  mime_type text not null,
  media_kind text not null check (media_kind in ('image', 'video')),
  file_size bigint not null,
  width integer,
  height integer,
  duration double precision,
  storage_key text,
  compressed_storage_key text,
  thumbnail_key text,
  file_hash text not null,
  upload_mode text not null check (upload_mode in ('original', 'compressed')),
  processing_status text not null default 'uploading'
    check (processing_status in ('uploading', 'processing', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  -- Duplicate uploads (same bytes in the same trip) are rejected in app
  -- logic with one exception: rows whose previous upload failed may be
  -- retried. Retried uploads share (trip_id, file_hash), so the index below
  -- is advisory only and the app enforces the rule via a filtered query.
  unique (trip_id, file_hash)
);

create index media_trip_status_created_idx
  on public.media (trip_id, processing_status, created_at desc);
create index media_trip_uploader_idx
  on public.media (trip_id, uploaded_by);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- The backend uses the service_role key, which bypasses RLS. Enabling RLS
-- here guarantees that any weaker key (anon / authenticated / future
-- service keys with limited grants) cannot touch these tables until an
-- explicit policy is added. No policies are created intentionally.
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.join_requests enable row level security;
alter table public.media enable row level security;

comment on table public.trips is
  'TripVault trips. RLS enabled; backend authorizes with the service_role key which bypasses RLS.';
comment on table public.trip_members is
  'TripVault trip members. RLS enabled; backend authorizes with the service_role key which bypasses RLS.';
comment on table public.join_requests is
  'TripVault join requests. RLS enabled; backend authorizes with the service_role key which bypasses RLS.';
comment on table public.media is
  'TripVault uploaded media. RLS enabled; backend authorizes with the service_role key which bypasses RLS.';
