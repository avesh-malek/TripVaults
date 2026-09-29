import type { JoinRequest, JoinRequestStatus } from '@tripvault/shared';
import { supabase } from '../supabase.js';
import { unwrap } from './helpers.js';

export interface JoinRequestRow {
  id: string;
  trip_id: string;
  session_id: string;
  name: string;
  status: JoinRequestStatus;
  created_at: string;
  responded_at: string | null;
}

export interface JoinRequestInsert {
  id?: string;
  trip_id: string;
  session_id: string;
  name: string;
  status: JoinRequestStatus;
}

function mapJoinRequest(row: JoinRequestRow): JoinRequest {
  return {
    id: row.id,
    trip_id: row.trip_id,
    session_id: row.session_id,
    name: row.name,
    status: row.status,
    created_at: row.created_at,
    responded_at: row.responded_at,
  };
}

async function one(
  query: PromiseLike<{ data: JoinRequestRow | null; error: unknown }>,
): Promise<JoinRequest | null> {
  const { data, error } = await query;
  const row = unwrap<JoinRequestRow | null>(data, error as never, 'joinRequest');
  return row ? mapJoinRequest(row) : null;
}

export const joinRequestRepository = {
  async create(input: JoinRequestInsert): Promise<JoinRequest> {
    const { data, error } = await supabase.from('join_requests').insert(input).select().single();
    return mapJoinRequest(unwrap<JoinRequestRow>(data, error, 'joinRequest.create'));
  },

  findById(id: string): Promise<JoinRequest | null> {
    return one(supabase.from('join_requests').select('*').eq('id', id).maybeSingle());
  },

  /** Only pending requests — handled ones disappear from the owner's queue. */
  async listPendingByTrip(tripId: string): Promise<JoinRequest[]> {
    const { data, error } = await supabase
      .from('join_requests')
      .select('*')
      .eq('trip_id', tripId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    return unwrap<JoinRequestRow[]>(data ?? [], error, 'joinRequest.listPending').map(mapJoinRequest);
  },

  findPendingByTripAndSession(tripId: string, sessionId: string): Promise<JoinRequest | null> {
    return one(
      supabase
        .from('join_requests')
        .select('*')
        .eq('trip_id', tripId)
        .eq('session_id', sessionId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    );
  },

  /** Latest request of any status for this session (for invite status checks). */
  findLatestByTripAndSession(tripId: string, sessionId: string): Promise<JoinRequest | null> {
    return one(
      supabase
        .from('join_requests')
        .select('*')
        .eq('trip_id', tripId)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    );
  },

  async setStatus(id: string, status: JoinRequestStatus): Promise<JoinRequest> {
    const { data, error } = await supabase
      .from('join_requests')
      .update({ status, responded_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return mapJoinRequest(unwrap<JoinRequestRow>(data, error, 'joinRequest.setStatus'));
  },

  async deleteByTrip(tripId: string): Promise<void> {
    const { error } = await supabase.from('join_requests').delete().eq('trip_id', tripId);
    unwrap<null>(null, error, 'joinRequest.deleteByTrip');
  },
};
