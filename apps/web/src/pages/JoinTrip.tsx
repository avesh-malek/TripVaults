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
import { api, ApiError } from '../lib/api';
import { addKnownTrip, getJoinSessionId, peekSessionId, setSessionId } from '../lib/session';

export function JoinTrip() {
  const { inviteCode = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [joinSessionId, setJoinSessionId] = useState(() => getJoinSessionId(inviteCode));
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();

  const previewQuery = useQuery({
    queryKey: ['invite-preview', inviteCode],
    queryFn: () => api<InvitePreview>(`/trips/invite/${inviteCode}`),
    retry: 1,
    staleTime: 1000 * 60,
  });

  // Owner/returning-member fix: if this browser already holds a session for
  // this trip (e.g. the owner reopening their own invite link), reuse it
  // instead of the invite-scoped session so the backend recognizes the
  // existing membership instead of creating a duplicate.
  useEffect(() => {
    const tripId = previewQuery.data?.trip.id;
    if (!tripId) return;
    const existing = peekSessionId(tripId);
    if (existing && existing !== joinSessionId) setJoinSessionId(existing);
  }, [previewQuery.data?.trip.id, joinSessionId]);

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
  const cardClass =
    'rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 dark:border-stone-800 dark:bg-stone-900';

  const renderPreviewError = () => {
    const err = previewQuery.error;
    const invalid = err instanceof ApiError && err.status === 404;
    return (
      <div className="mt-6">
        <EmptyState
          icon={invalid ? '🔗' : '⚠️'}
          title={
            invalid
              ? 'This invite link is invalid or no longer exists.'
              : 'Could not load this invite.'
          }
          description={
            invalid
              ? 'Double-check the link with whoever sent it to you — it may have a typo, or the trip may have been deleted.'
              : err instanceof Error
                ? err.message
                : 'Check your connection and try again.'
          }
          action={
            <div className="flex justify-center gap-2">
              {!invalid && (
                <Button variant="secondary" onClick={() => previewQuery.refetch()}>
                  Retry
                </Button>
              )}
              <Link to="/">
                <Button variant={invalid ? 'secondary' : 'ghost'}>Go home</Button>
              </Link>
            </div>
          }
        />
      </div>
    );
  };

  const renderJoinForm = (declined: boolean) => {
    const trip = previewQuery.data!.trip;
    const { memberCount, ownerName } = previewQuery.data!;
    return (
      <div className={`mt-6 ${cardClass}`}>
        {declined && (
          <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950">
            <p className="text-sm text-amber-900 dark:text-amber-200">
              <span className="font-semibold">Your previous request was declined.</span> You can
              ask to join again below — maybe with a name the owner will recognize.
            </p>
          </div>
        )}
        <Badge color={trip.access_type === 'open' ? 'green' : 'amber'}>
          {trip.access_type === 'open' ? 'Open invite' : 'Approval required'}
        </Badge>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-gray-900 dark:text-stone-100">
          {trip.name}
        </h1>
        {trip.description && (
          <p className="mt-1 text-sm text-gray-600 dark:text-stone-400">{trip.description}</p>
        )}
        <p className="mt-3 text-sm text-gray-500 dark:text-stone-400">
          Hosted by <span className="font-medium text-gray-700 dark:text-stone-300">{ownerName}</span>{' '}
          · {memberCount} member{memberCount === 1 ? '' : 's'} so far
        </p>

        {statusQuery.isError && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 dark:border-amber-800 dark:bg-amber-950">
            <p className="text-xs text-amber-900 dark:text-amber-200">
              Couldn&apos;t check your invite status — you can still try joining.
            </p>
            <Button size="sm" variant="secondary" onClick={() => statusQuery.refetch()}>
              Retry
            </Button>
          </div>
        )}

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
          <Button size="lg" className="mt-4 w-full" loading={joinMutation.isPending} onClick={submit}>
            {trip.access_type === 'open' ? 'Join the trip 🎉' : declined ? 'Request to join again' : 'Request to join'}
          </Button>
          {trip.access_type === 'approval' && (
            <p className="mt-2 text-center text-xs text-gray-500 dark:text-stone-400">
              The trip owner will approve your request before you can enter.
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <PageContainer className="max-w-xl">
      <Link
        to="/"
        className="text-sm font-medium text-teal-700 hover:text-teal-900 dark:text-teal-300 dark:hover:text-teal-200"
      >
        ← Back home
      </Link>

      {previewQuery.isLoading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {previewQuery.isError && renderPreviewError()}

      {previewQuery.isSuccess &&
        (() => {
          const { trip } = previewQuery.data;
          const expired = trip.status === 'expired' || trip.status === 'deleted';

          if (expired) {
            return (
              <div className="mt-6">
                <EmptyState
                  icon="⏳"
                  title="This trip gallery has expired."
                  description="Trip galleries are temporary by design — this one's time is up, and its photos are gone."
                  action={
                    <Link to="/trips/create">
                      <Button>Create your own trip</Button>
                    </Link>
                  }
                />
              </div>
            );
          }

          if (status === 'member') {
            // The auto-enter effect is already redirecting; this is just the beat in between.
            return (
              <div className={`mt-6 text-center ${cardClass}`}>
                <div className="flex justify-center">
                  <Spinner />
                </div>
                <h1 className="mt-3 text-xl font-bold text-gray-900 dark:text-stone-100">
                  You&apos;re in!
                </h1>
                <p className="mt-1 text-sm text-gray-600 dark:text-stone-400">
                  Taking you to <span className="font-medium">{trip.name}</span>…
                </p>
              </div>
            );
          }

          if (status === 'pending') {
            return (
              <div className={`mt-6 text-center ${cardClass}`}>
                <div className="text-4xl" aria-hidden>
                  📨
                </div>
                <h1 className="mt-3 text-xl font-bold text-gray-900 dark:text-stone-100">
                  Request sent — waiting for approval
                </h1>
                <p className="mt-2 text-sm text-gray-600 dark:text-stone-400">
                  You&apos;ll be able to enter{' '}
                  <span className="font-medium">{trip.name}</span> once{' '}
                  {previewQuery.data.ownerName} approves you.
                </p>
                <div className="mt-4 flex justify-center">
                  <Spinner />
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-stone-500">
                  This page checks automatically — keep it open and you&apos;ll be let in as soon
                  as you&apos;re approved.
                </p>
              </div>
            );
          }

          // status === 'none' | 'rejected' | still loading → show the join form.
          return renderJoinForm(status === 'rejected');
        })()}
    </PageContainer>
  );
}
