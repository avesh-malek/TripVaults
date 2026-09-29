import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { JoinRequestsResponse, MembersResponse } from '@tripvault/shared';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Spinner } from './ui/Spinner';
import { EmptyState } from './ui/EmptyState';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { useToast } from './ui/Toast';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';

export interface MembersPanelProps {
  tripId: string;
  sessionId: string;
  isOwner: boolean;
  myMemberId: string;
  onLeft: () => void;
}

export function MembersPanel({ tripId, sessionId, isOwner, myMemberId, onLeft }: MembersPanelProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const membersQuery = useQuery({
    queryKey: ['members', tripId],
    queryFn: () => api<MembersResponse>(`/trips/${tripId}/members`, { sessionId }),
  });

  const requestsQuery = useQuery({
    queryKey: ['join-requests', tripId],
    queryFn: () => api<JoinRequestsResponse>(`/trips/${tripId}/join-requests`, { sessionId }),
    enabled: isOwner,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['members', tripId] });
    void queryClient.invalidateQueries({ queryKey: ['join-requests', tripId] });
  };

  const removeMutation = useMutation({
    mutationFn: (memberId: string) =>
      api(`/trips/${tripId}/members/${memberId}/remove`, { method: 'POST', sessionId }),
    onSuccess: () => {
      toast.success('Member removed');
      setRemoveTarget(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || 'Could not remove member'),
  });

  const approveMutation = useMutation({
    mutationFn: (requestId: string) =>
      api(`/trips/${tripId}/join-requests/${requestId}/approve`, { method: 'POST', sessionId }),
    onSuccess: () => {
      toast.success('Request approved — they can now join the gallery');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || 'Could not approve request'),
  });

  const rejectMutation = useMutation({
    mutationFn: (requestId: string) =>
      api(`/trips/${tripId}/join-requests/${requestId}/reject`, { method: 'POST', sessionId }),
    onSuccess: () => {
      toast.info('Request declined');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || 'Could not decline request'),
  });

  const leaveMutation = useMutation({
    mutationFn: () => api<{ left: true }>(`/trips/${tripId}/leave`, { method: 'POST', sessionId }),
    onSuccess: () => {
      toast.info('You left the trip');
      setConfirmLeave(false);
      onLeft();
    },
    onError: (e: Error) => toast.error(e.message || 'Could not leave the trip'),
  });

  const members = membersQuery.data?.members ?? [];
  const requests = requestsQuery.data?.requests ?? [];

  return (
    <div className="space-y-6">
      {/* Join requests (owner only) */}
      {isOwner && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Join requests {requests.length > 0 && `(${requests.length})`}
          </h3>
          {requestsQuery.isLoading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : requests.length === 0 ? (
            <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
              No pending requests. New requests will show up here for your approval.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
              {requests.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{r.name}</p>
                    <p className="text-xs text-gray-500">Requested {formatDate(r.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={rejectMutation.isPending}
                      onClick={() => rejectMutation.mutate(r.id)}
                    >
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      loading={approveMutation.isPending}
                      onClick={() => approveMutation.mutate(r.id)}
                    >
                      Approve
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Members */}
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Members ({members.length})
        </h3>
        {membersQuery.isLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : membersQuery.isError ? (
          <EmptyState title="Couldn't load members" description="Please try again in a moment." />
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                    {m.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {m.name}
                      {m.id === myMemberId && <span className="ml-1 font-normal text-gray-400">(you)</span>}
                    </p>
                    <p className="text-xs text-gray-500">Joined {formatDate(m.joined_at)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {m.role === 'owner' && <Badge color="indigo">Owner</Badge>}
                  {isOwner && m.role !== 'owner' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="!text-red-600 hover:!bg-red-50"
                      onClick={() => setRemoveTarget({ id: m.id, name: m.name })}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Leave */}
      {!isOwner && (
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <Button variant="secondary" onClick={() => setConfirmLeave(true)}>
            Leave trip
          </Button>
          <p className="mt-2 text-xs text-gray-500">
            You'll lose access to this gallery. The trip owner can re-invite you later.
          </p>
        </section>
      )}

      <ConfirmDialog
        open={!!removeTarget}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => removeTarget && removeMutation.mutate(removeTarget.id)}
        title={`Remove ${removeTarget?.name ?? 'member'}?`}
        message="They'll lose access to the trip gallery immediately. Their uploaded photos stay in the gallery."
        confirmLabel="Remove"
        danger
        loading={removeMutation.isPending}
      />
      <ConfirmDialog
        open={confirmLeave}
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => leaveMutation.mutate()}
        title="Leave this trip?"
        message="You'll lose access to the gallery. You can rejoin later with a new invite link."
        confirmLabel="Leave trip"
        danger
        loading={leaveMutation.isPending}
      />
    </div>
  );
}
