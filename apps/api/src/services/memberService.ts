import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  joinTripSchema,
  type InvitePreview,
  type InviteStatusResponse,
  type JoinRequestsResponse,
  type JoinTripResponse,
  type MemberPublic,
  type MembersResponse,
  type Trip,
  type TripMember,
} from '@tripvault/shared';
import { tripRepository } from '../db/repositories/tripRepository.js';
import { memberRepository, toPublic } from '../db/repositories/memberRepository.js';
import { joinRequestRepository } from '../db/repositories/joinRequestRepository.js';
import { AppError } from '../utils/appError.js';

type JoinTripInput = z.infer<typeof joinTripSchema>;

function requireJoinable(trip: Trip): void {
  const joinable = trip.status === 'active' || trip.status === 'expiring_soon';
  if (!joinable) {
    throw new AppError(410, 'TRIP_UNAVAILABLE', 'This trip is no longer accepting members.');
  }
}

export const memberService = {
  async invitePreview(inviteCode: string): Promise<InvitePreview> {
    const trip = await tripRepository.findByInviteCode(inviteCode);
    if (!trip || trip.status === 'deleted') {
      throw new AppError(404, 'INVALID_INVITE', 'This invite link is invalid.');
    }
    const [memberCount, owner] = await Promise.all([
      memberRepository.countActiveByTrip(trip.id),
      memberRepository.findOwnerByTrip(trip.id),
    ]);
    return {
      trip: {
        id: trip.id,
        name: trip.name,
        description: trip.description,
        access_type: trip.access_type,
        expires_at: trip.expires_at,
        status: trip.status,
      },
      memberCount,
      ownerName: owner?.name ?? 'Unknown',
    };
  },

  async inviteStatus(inviteCode: string, sessionId: string): Promise<InviteStatusResponse> {
    const trip = await tripRepository.findByInviteCode(inviteCode);
    if (!trip || trip.status === 'deleted') {
      return { status: 'none', tripId: null };
    }

    const member = await memberRepository.findActiveByTripAndSession(trip.id, sessionId);
    if (member) return { status: 'member', tripId: trip.id };

    const request = await joinRequestRepository.findLatestByTripAndSession(trip.id, sessionId);
    if (!request) return { status: 'none', tripId: trip.id };
    if (request.status === 'pending') return { status: 'pending', tripId: trip.id };
    if (request.status === 'rejected') return { status: 'rejected', tripId: trip.id };
    // Approved requests always create a member; fall back to 'member' defensively.
    return { status: 'member', tripId: trip.id };
  },

  async joinByInviteCode(inviteCode: string, input: JoinTripInput, sessionId: string): Promise<JoinTripResponse> {
    const trip = await tripRepository.findByInviteCode(inviteCode);
    if (!trip || trip.status === 'deleted') {
      throw new AppError(404, 'INVALID_INVITE', 'This invite link is invalid.');
    }
    requireJoinable(trip);

    const existing = await memberRepository.findByTripAndSession(trip.id, sessionId);
    if (existing?.status === 'active') {
      return { status: 'joined', trip, member: toPublic(existing) };
    }
    if (existing?.status === 'removed') {
      throw new AppError(403, 'MEMBER_REMOVED', 'You were removed from this trip.');
    }
    const previouslyLeft = existing?.status === 'left' ? existing : null;

    if (trip.access_type === 'open') {
      const member = previouslyLeft
        ? await memberRepository.reactivate(previouslyLeft.id, input.name)
        : await memberRepository.create({
            id: randomUUID(),
            trip_id: trip.id,
            session_id: sessionId,
            name: input.name,
            role: 'member',
            status: 'active',
          });
      return { status: 'joined', trip, member: toPublic(member) };
    }

    // Approval flow.
    const pending = await joinRequestRepository.findPendingByTripAndSession(trip.id, sessionId);
    if (pending) return { status: 'pending', joinRequest: pending };

    const joinRequest = await joinRequestRepository.create({
      id: randomUUID(),
      trip_id: trip.id,
      session_id: sessionId,
      name: input.name,
      status: 'pending',
    });
    return { status: 'pending', joinRequest };
  },

  async listMembers(tripId: string): Promise<MembersResponse> {
    const members = await memberRepository.listActiveByTrip(tripId);
    return { members: members.map(toPublic) };
  },

  async listJoinRequests(tripId: string): Promise<JoinRequestsResponse> {
    const requests = await joinRequestRepository.listByTrip(tripId);
    return { requests };
  },

  /** Approve a pending join request; idempotent if the member already exists. */
  async approveRequest(tripId: string, requestId: string): Promise<{ member: MemberPublic }> {
    const request = await joinRequestRepository.findById(requestId);
    if (!request || request.trip_id !== tripId) {
      throw new AppError(404, 'JOIN_REQUEST_NOT_FOUND', 'Join request not found.');
    }
    if (request.status !== 'pending') {
      throw new AppError(409, 'REQUEST_NOT_PENDING', 'This join request has already been handled.');
    }

    await joinRequestRepository.setStatus(request.id, 'approved');

    const existing = await memberRepository.findByTripAndSession(tripId, request.session_id);
    const member: TripMember =
      existing?.status === 'active'
        ? existing
        : existing?.status === 'left'
          ? await memberRepository.reactivate(existing.id, request.name)
          : await memberRepository.create({
              id: randomUUID(),
              trip_id: tripId,
              session_id: request.session_id,
              name: request.name,
              role: 'member',
              status: 'active',
            });

    return { member: toPublic(member) };
  },

  async rejectRequest(tripId: string, requestId: string): Promise<{ rejected: true }> {
    const request = await joinRequestRepository.findById(requestId);
    if (!request || request.trip_id !== tripId) {
      throw new AppError(404, 'JOIN_REQUEST_NOT_FOUND', 'Join request not found.');
    }
    if (request.status !== 'pending') {
      throw new AppError(409, 'REQUEST_NOT_PENDING', 'This join request has already been handled.');
    }
    await joinRequestRepository.setStatus(request.id, 'rejected');
    return { rejected: true };
  },

  async removeMember(tripId: string, memberId: string, owner: TripMember): Promise<{ removed: true }> {
    const target = await memberRepository.findById(memberId);
    if (!target || target.trip_id !== tripId) {
      throw new AppError(404, 'MEMBER_NOT_FOUND', 'Member not found.');
    }
    if (target.role === 'owner') {
      throw new AppError(400, 'CANNOT_REMOVE_OWNER', 'The trip owner cannot be removed.');
    }
    if (target.id === owner.id) {
      throw new AppError(400, 'CANNOT_REMOVE_SELF', 'You cannot remove yourself; leave the trip instead.');
    }
    await memberRepository.setStatus(target.id, 'removed');
    return { removed: true };
  },

  async leaveTrip(member: TripMember): Promise<{ left: true }> {
    if (member.role === 'owner') {
      throw new AppError(400, 'OWNER_CANNOT_LEAVE', 'The trip owner cannot leave; delete or transfer the trip instead.');
    }
    await memberRepository.setStatus(member.id, 'left');
    return { left: true };
  },
};
