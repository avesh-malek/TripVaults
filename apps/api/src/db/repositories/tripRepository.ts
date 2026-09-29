import type { AccessType, Trip, TripStatus } from '@tripvault/shared';
import { supabase } from '../supabase.js';
import { unwrap } from './helpers.js';

export interface TripRow {
  id: string;
  name: string;
  description: string | null;
  owner_member_id: string | null;
  invite_code: string;
  access_type: AccessType;
  expires_at: string;
  status: TripStatus;
  created_at: string;
  updated_at: string;
}

export interface TripInsert {
  id: string;
  name: string;
  description: string | null;
  owner_member_id: string | null;
  invite_code: string;
  access_type: AccessType;
  expires_at: string;
  status: TripStatus;
}

export type TripPatch = Partial<
  Pick<TripRow, 'name' | 'description' | 'owner_member_id' | 'access_type' | 'expires_at' | 'status'>
>;

function mapTrip(row: TripRow): Trip {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    owner_member_id: row.owner_member_id,
    invite_code: row.invite_code,
    access_type: row.access_type,
    expires_at: row.expires_at,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function one(query: PromiseLike<{ data: TripRow | null; error: unknown }>): Promise<Trip | null> {
  const { data, error } = await query;
  const row = unwrap<TripRow | null>(data, error as never, 'trip');
  return row ? mapTrip(row) : null;
}

async function many(query: PromiseLike<{ data: TripRow[] | null; error: unknown }>): Promise<Trip[]> {
  const { data, error } = await query;
  return unwrap<TripRow[]>(data ?? [], error as never, 'trips').map(mapTrip);
}

export const tripRepository = {
  async create(input: TripInsert): Promise<Trip> {
    const { data, error } = await supabase.from('trips').insert(input).select().single();
    return mapTrip(unwrap<TripRow>(data, error, 'trip.create'));
  },

  findById(id: string): Promise<Trip | null> {
    return one(supabase.from('trips').select('*').eq('id', id).maybeSingle());
  },

  findByInviteCode(code: string): Promise<Trip | null> {
    return one(supabase.from('trips').select('*').eq('invite_code', code).maybeSingle());
  },

  async update(id: string, patch: TripPatch): Promise<Trip> {
    const { data, error } = await supabase.from('trips').update(patch).eq('id', id).select().single();
    return mapTrip(unwrap<TripRow>(data, error, 'trip.update'));
  },

  updateStatus(id: string, status: TripStatus): Promise<Trip> {
    return tripRepository.update(id, { status });
  },

  /** Active trips expiring after `afterIso` and at/before `beforeIso` (→ expiring_soon). */
  findActiveExpiringBetween(afterIso: string, beforeIso: string): Promise<Trip[]> {
    return many(
      supabase
        .from('trips')
        .select('*')
        .eq('status', 'active')
        .gt('expires_at', afterIso)
        .lte('expires_at', beforeIso),
    );
  },

  /** Trips still marked live whose expiry has passed (→ expired). */
  findLiveExpiredBefore(nowIso: string): Promise<Trip[]> {
    return many(
      supabase
        .from('trips')
        .select('*')
        .in('status', ['active', 'expiring_soon'])
        .lte('expires_at', nowIso),
    );
  },

  /** Trips in 'expired' status past the grace-warning cutoff (→ grace_period). */
  findExpiredBefore(cutoffIso: string): Promise<Trip[]> {
    return many(
      supabase.from('trips').select('*').eq('status', 'expired').lte('expires_at', cutoffIso),
    );
  },

  /** Trips past the grace period whose data must be purged (→ deleted). */
  findDeletableBefore(cutoffIso: string): Promise<Trip[]> {
    return many(
      supabase
        .from('trips')
        .select('*')
        .in('status', ['expired', 'grace_period'])
        .lte('expires_at', cutoffIso),
    );
  },
};
