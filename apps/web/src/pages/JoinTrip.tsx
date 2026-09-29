import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { InvitePreview, InviteStatusResponse, JoinTripResponse } from '@tripvault/shared';
import { PageContainer } from '../components/ui/PageContainer';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { api } from '../lib/api';
import { addKnownTrip, setSessionId } from '../lib/session';

const joinSessionKey = (inviteCode: string) => `tripvault:join-session:${inviteCode}`;

function getJoinSessionId(inviteCode: string): string {
  try {
    const existing = localStorage.getItem(joinSessionKey(inviteCode));
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(joinSessionKey(inviteCode), fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

export function JoinTrip() {
  const { inviteCode = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [joinSessionId] = useState(() => getJoinSessionId(inviteCode));
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();

  const previewQuery = useQuery({
    queryKey: ['invite-preview', inviteCode],
    queryFn: () => api<InvitePreview>(`/trips/invite/${inviteCode}`),
    retry: 1,
    staleTime: 1000 * 60,
  });

  const statusQuery = useQuery({
    queryKey: ['invite-status', inviteCode, joinSessionId],
    queryFn: () =>
      api<InviteStatusResponse>(`/trips/invite/${inviteCode}/status`, { sessionId: joinSessionId }),
    enabled: previewQuery.isSuccess,
    retry: 1,
    // Keep polling while a join request is pending so the user auto-enters on approval.
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 5000 : false),
  });

  const enterTrip = (tripId: string, tripName: string) => {
    setSessionId(tripId, joinSessionId);
    addKnownTrip({ tripId, inviteCode, name: tripName, sessionId: joinSessionId });
    navigate(`/trips/${tripId}`, { replace: true });
  };

  // Already a member (e.g. opened the link on a device that joined before).
  useEffect(() => {
    const status = statusQuery.data?.status;
    if (status === 'member' && statusQuery.data?.tripId) {
      enterTrip(statusQuery.data.tripId, previewQuery.data?.trip.name ?? 'Trip');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusQuery.data?.status]);

  const joinMutation = useMutation({
    mutationFn: () =>
      api<JoinTripResponse>(`/trips/join/${inviteCode}`, {
        method: 'POST',
        sessionId: joinSessionId,
        body: { name: name.trim() },
      }),
    onSuccess: (data) => {
      if (data.status === 'joined') {
        toast.success(`Welcome to ${data.trip.name}! 🎉`);
        enterTrip(data.trip.id, data.trip.name);
      } else {
        toast.info('Request sent to the trip owner');
        void statusQuery.refetch();
      }
    },
    onError: (e: Error) => toast.error(e.message || 'Could not join the trip'),
  });

  const submit = () => {
    if (name.trim().length < 1) {
      setNameError('Tell everyone your name so they know whose photos are whose.');
      return;
    }
    setNameError(undefined);
    joinMutation.mutate();
  };

  const status = statusQuery.data?.status;

  return (
    <PageContainer className="max-w-xl">
      <Link to="/" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
        ← Back home
      </Link>

      {previewQuery.isLoading && (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      )}

      {previewQuery.isError && (
        <div className="mt-6">
          <EmptyState
            icon="🔗"
            title="This invite link is invalid or no longer exists."
            description="Double-check the link with whoever sent it to you — it may have a typo, or the trip may have been deleted."
            action={
              <Link to="/"><Button variant="secondary">Go home</Button></Link>
            }
          />
        </div>
      )}

      {previewQuery.isSuccess && (() => {
        const { trip, memberCount, ownerName } = previewQuery.data;
        const expired = trip.status === 'expired' || trip.status === 'deleted';

        if (expired) {
          return (
            <div className="mt-6">
              <EmptyState
                icon="⏳"
                title="This trip gallery has expired."
                description="Trip galleries are temporary by design — this one's time is up, and its photos are gone."
                action={<Link to="/trips/create"><Button>Create your own trip</Button></Link>}
              />
            </div>
          );
        }

        if (status === 'rejected') {
          return (
            <div className="mt-6">
              <EmptyState
                icon="🙁"
                title="Your request wasn't approved"
                description="The trip owner declined your request to join this gallery."
                action={<Link to="/"><Button variant="secondary">Go home</Button></Link>}
              />
            </div>
          );
        }

        if (status === 'pending') {
          return (
            <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 text-center">
              <div className="text-4xl">📨</div>
              <h1 className="mt-3 text-xl font-bold text-gray-900">Request sent</h1>
              <p className="mt-2 text-sm text-gray-600">
                You'll be able to enter <span className="font-medium">{trip.name}</span> once{' '}
                {ownerName} approves you. This page will let you in automatically — no need to refresh.
              </p>
              <div className="mt-4 flex justify-center"><Spinner /></div>
            </div>
          );
        }

        return (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
            <Badge color={trip.access_type === 'open' ? 'green' : 'amber'}>
              {trip.access_type === 'open' ? 'Open invite' : 'Approval required'}
            </Badge>
            <h1 className="mt-3 text-2xl font-bold text-gray-900">{trip.name}</h1>
            {trip.description && <p className="mt-1 text-sm text-gray-600">{trip.description}</p>}
            <p className="mt-3 text-sm text-gray-500">
              Hosted by <span className="font-medium text-gray-700">{ownerName}</span> · {memberCount} member{memberCount === 1 ? '' : 's'} so far
            </p>

            <div className="mt-6">
              <Input
                label="Your name"
                placeholder="What should everyone call you?"
                value={name}
                maxLength={50}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit();
                }}
                error={nameError}
              />
              <Button
                size="lg"
                className="mt-4 w-full"
                loading={joinMutation.isPending}
                onClick={submit}
              >
                {trip.access_type === 'open' ? 'Join the trip 🎉' : 'Request to join'}
              </Button>
              {trip.access_type === 'approval' && (
                <p className="mt-2 text-center text-xs text-gray-500">
                  The trip owner will approve your request before you can enter.
                </p>
              )}
            </div>
          </div>
        );
      })()}
    </PageContainer>
  );
}
