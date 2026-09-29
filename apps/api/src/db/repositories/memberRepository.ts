import type { MemberPublic, MemberRole, MemberStatus, TripMember } from '@tripvault/shared';
import { supabase } from '../supabase';
import { unwrap } from './helpers';
import { logger } from '../../utils/logger';

export interface MemberRow {
  id: string;
  trip_id: string;
  session_id: string;
  name: string;
  role: MemberRole;
  status: MemberStatus;
  joined_at: string;
  last_seen_at: string;
}

export interface MemberInsert {
  id?: string;
  trip_id: string;
  session_id: string;
  name: string;
  role: MemberRole;
  status: MemberStatus;
}

function mapMember(row: MemberRow): TripMember {
  return {
    id: row.id,
    trip_id: row.trip_id,
    session_id: row.session_id,
    name: row.name,
    role: row.role,
    status: row.status,
    joined_at: row.joined_at,
    last_seen_at: row.last_seen_at,
  };
}

export function toPublic(member: TripMember): MemberPublic {
  const { session_id: _sessionId, ...rest } = member;
  return rest as MemberPublic;
}

async function one(query: PromiseLike<{ data: MemberRow | null; error: unknown }>): Promise<TripMember | null> {
  const { data, error } = await query;
  const row = unwrap<MemberRow | null>(data, error as never, 'member');
  return row ? mapMember(row) : null;
}

export const memberRepository = {
  async create(input: MemberInsert): Promise<TripMember> {
    const { data, error } = await supabase.from('trip_members').insert(input).select().single();
    return mapMember(unwrap<MemberRow>(data, error, 'member.create'));
  },

  findById(id: string): Promise<TripMember | null> {
    return one(supabase.from('trip_members').select('*').eq('id', id).maybeSingle());
  },

  /** Most recent membership row for this session in the trip, any status. */
  findByTripAndSession(tripId: string, sessionId: string): Promise<TripMember | null> {
    return one(
      supabase
        .from('trip_members')
        .select('*')
        .eq('trip_id', tripId)
        .eq('session_id', sessionId)
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    );
  },

  findActiveByTripAndSession(tripId: string, sessionId: string): Promise<TripMember | null> {
    return one(
      supabase
        .from('trip_members')
        .select('*')
        .eq('trip_id', tripId)
        .eq('session_id', sessionId)
        .eq('status', 'active')
        .maybeSingle(),
    );
  },

  async listActiveByTrip(tripId: string): Promise<TripMember[]> {
    const { data, error } = await supabase
      .from('trip_members')
      .select('*')
      .eq('trip_id', tripId)
      .eq('status', 'active')
      .order('joined_at', { ascending: true });
    return unwrap<MemberRow[]>(data ?? [], error, 'member.list').map(mapMember);
  },

  async countActiveByTrip(tripId: string): Promise<number> {
    const { count, error } = await supabase
      .from('trip_members')
      .select('id', { count: 'exact', head: true })
      .eq('trip_id', tripId)
      .eq('status', 'active');
    if (error) throw unwrap<never>(null, error, 'member.count');
    return count ?? 0;
  },

  async findOwnerByTrip(tripId: string): Promise<TripMember | null> {
    return one(
      supabase
        .from('trip_members')
        .select('*')
        .eq('trip_id', tripId)
        .eq('role', 'owner')
        .eq('status', 'active')
        .maybeSingle(),
    );
  },

  async setStatus(id: string, status: MemberStatus): Promise<TripMember> {
    const { data, error } = await supabase
      .from('trip_members')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    return mapMember(unwrap<MemberRow>(data, error, 'member.setStatus'));
  },

  /** Reactivate a member who previously left (used on rejoin). */
  async reactivate(id: string, name: string): Promise<TripMember> {
    const { data, error } = await supabase
      .from('trip_members')
      .update({ status: 'active', name, joined_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return mapMember(unwrap<MemberRow>(data, error, 'member.reactivate'));
  },

  /** Fire-and-forget presence touch; never throws. */
  async touchLastSeen(id: string): Promise<void> {
    const { error } = await supabase
      .from('trip_members')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      // Presence is best-effort; log and swallow.
      logger.warn(`touchLastSeen failed for member ${id}: ${error.message}`);
    }
  },

  async deleteByTrip(tripId: string): Promise<void> {
    const { error } = await supabase.from('trip_members').delete().eq('trip_id', tripId);
    unwrap<null>(null, error, 'member.deleteByTrip');
  },
};
