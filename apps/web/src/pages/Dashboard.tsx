import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import type {
  InvitePreview,
  InviteStatusResponse,
  TripDetailResponse,
} from '@tripvault/shared';
import { PageContainer } from '../components/ui/PageContainer';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';
import { ApiError, api } from '../lib/api';
import {
  addKnownTrip,
  findKnownTrip,
  getJoinSessionId,
  getKnownTrips,
  removeKnownTrip,
  setSessionId,
  type KnownTrip,
} from '../lib/session';
import { expiresLabel } from '../lib/format';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

interface TripEntry {
  known: KnownTrip;
  detail?: TripDetailResponse;
  isLoading: boolean;
  isError: boolean;
}

function StatusBadge({ detail }: { detail: TripDetailResponse }) {
  const status = detail.trip.status;
  if (status === 'active') return <Badge color="teal">{expiresLabel(detail.expiresInHours)}</Badge>;
  if (status === 'expiring_soon') return <Badge color="amber">Expiring soon</Badge>;
  if (status === 'grace_period') return <Badge color="amber">Expired — downloads only</Badge>;
  return <Badge color="gray">Expired</Badge>;
}

function fileCountLabel(detail: TripDetailResponse): string {
  const total = detail.photoCount + detail.videoCount;
  return `${total} file${total === 1 ? '' : 's'}`;
}

/* ------------------------------------------------------------------ */
/* Trip card                                                           */
/* ------------------------------------------------------------------ */

interface TripCardProps {
  entry: TripEntry;
  onRemove: (tripId: string, name: string) => void;
  onLeave: (tripId: string, name: string, sessionId: string) => void;
}

function TripCard({ entry, onRemove, onLeave }: TripCardProps) {
  const { known, detail } = entry;
  const name = detail?.trip.name ?? known.name;
  const isOwner = detail?.isOwner ?? false;

  return (
    <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-start justify-between gap-2">
        <h2 className="min-w-0 flex-1 truncate text-lg font-semibold text-gray-900 dark:text-stone-100">
          {name}
        </h2>
        <button
          type="button"
          onClick={() => onRemove(known.tripId, name)}
          aria-label={`Remove ${name} from your list`}
          title="Remove from your list"
          className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-stone-500 dark:hover:bg-stone-800 dark:hover:text-stone-300"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {detail && (
        <div className="mt-2">
          <StatusBadge detail={detail} />
        </div>
      )}

      <p className="mt-2 flex-1 text-sm text-gray-500 dark:text-stone-400">
        {entry.isError ? (
          'Couldn’t load this trip — it may have expired or been deleted.'
        ) : detail ? (
          <>
            {detail.memberCount} member{detail.memberCount === 1 ? '' : 's'} · {fileCountLabel(detail)}
          </>
        ) : (
          'Loading…'
        )}
      </p>

      <div className="mt-4">
        {!entry.isError && detail ? (
          <Link to={`/trips/${known.tripId}`}>
            <Button className="w-full" size="sm">
              Open gallery
            </Button>
          </Link>
        ) : (
          <Button className="w-full" size="sm" disabled>
            Open gallery
          </Button>
        )}
        {!isOwner && detail && !entry.isError && (
          <button
            type="button"
            onClick={() => onLeave(known.tripId, name, known.sessionId)}
            className="mt-2 w-full text-center text-xs font-medium text-red-600 transition-colors hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            Leave trip
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export function Dashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const [knownTrips, setKnownTrips] = useState<KnownTrip[]>(getKnownTrips);
  const [code, setCode] = useState('');
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ tripId: string; name: string } | null>(null);
  const [leaveTarget, setLeaveTarget] = useState<{ tripId: string; name: string; sessionId: string } | null>(null);
  const [leaving, setLeaving] = useState(false);

  const detailQueries = useQueries({
    queries: knownTrips.map((t) => ({
      queryKey: ['trip-detail', t.tripId],
      queryFn: () => api<TripDetailResponse>(`/trips/${t.tripId}`, { sessionId: t.sessionId }),
      retry: 1,
      staleTime: 1000 * 60,
    })),
  });

  const entries: TripEntry[] = knownTrips.map((known, i) => ({
    known,
    detail: detailQueries[i]?.data,
    isLoading: detailQueries[i]?.isLoading ?? false,
    isError: detailQueries[i]?.isError ?? false,
  }));

  const initialLoading = knownTrips.length > 0 && detailQueries.every((q) => q.isLoading);
  const owned = entries.filter((e) => e.detail?.isOwner);
  const memberOf = entries.filter((e) => e.detail && !e.detail.isOwner);
  const stale = entries.filter((e) => !e.isLoading && !e.detail);

  const refreshKnownTrips = () => setKnownTrips(getKnownTrips());

  /* ------------------------- join by code ------------------------- */

  const joinWithCode = async () => {
    const inviteCode = code.trim().toUpperCase();
    if (!inviteCode || joinBusy) return;
    setJoinBusy(true);
    setJoinError(null);
    try {
      const preview = await api<InvitePreview>(`/trips/invite/${inviteCode}`);
      if (preview.trip.status !== 'active' && preview.trip.status !== 'expiring_soon') {
        setJoinError('This gallery has expired and is no longer accepting members.');
        return;
      }
      // Reuse the existing session when this device already knows the trip
      // (e.g. an owner reopening their own invite) so no duplicate member
      // is created.
      const known = findKnownTrip(preview.trip.id);
      const sessionId = known?.sessionId ?? getJoinSessionId(inviteCode);
      const status = await api<InviteStatusResponse>(`/trips/invite/${inviteCode}/status`, {
        sessionId,
      });
      if (status.status === 'member' && status.tripId) {
        setSessionId(status.tripId, sessionId);
        addKnownTrip({ tripId: status.tripId, inviteCode, name: preview.trip.name, sessionId });
        refreshKnownTrips();
        navigate(`/trips/${status.tripId}`);
        return;
      }
      // Pending / rejected / brand-new: the join page collects the display
      // name and handles the open/approval flow with proper waiting states.
      navigate(`/join/${inviteCode}`);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 410)) {
        setJoinError('Invalid or expired invite code. Check the code and try again.');
      } else {
        setJoinError(e instanceof Error ? e.message : 'Could not use this invite code.');
      }
    } finally {
      setJoinBusy(false);
    }
  };

  /* ------------------------- remove / leave ------------------------ */

  const confirmRemove = () => {
    if (!removeTarget) return;
    removeKnownTrip(removeTarget.tripId);
    refreshKnownTrips();
    toast.info(`Removed “${removeTarget.name}” from your list`);
    setRemoveTarget(null);
  };

  const confirmLeave = async () => {
    if (!leaveTarget || leaving) return;
    setLeaving(true);
    try {
      await api(`/trips/${leaveTarget.tripId}/leave`, {
        method: 'POST',
        sessionId: leaveTarget.sessionId,
      });
      removeKnownTrip(leaveTarget.tripId);
      refreshKnownTrips();
      toast.success(`You left “${leaveTarget.name}”`);
      setLeaveTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not leave the trip');
    } finally {
      setLeaving(false);
    }
  };

  /* ------------------------------ render --------------------------- */

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl dark:text-stone-100">My trips</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-stone-400">
            Every trip gallery you&apos;ve created or joined on this device.
          </p>
        </div>
        <Link to="/trips/create">
          <Button>+ New Trip</Button>
        </Link>
      </div>

      {/* Join by code */}
      <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
        <label htmlFor="invite-code" className="text-sm font-medium text-gray-900 dark:text-stone-100">
          Join with an invite code
        </label>
        <div className="mt-2 flex gap-2">
          <Input
            id="invite-code"
            placeholder="e.g. AB12CD"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setJoinError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void joinWithCode();
            }}
            aria-label="Invite code"
            className="flex-1"
            maxLength={16}
          />
          <Button
            variant="secondary"
            onClick={() => void joinWithCode()}
            disabled={!code.trim() || joinBusy}
            loading={joinBusy}
            className="shrink-0"
          >
            Join
          </Button>
        </div>
        {joinError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
            {joinError}
          </p>
        )}
        <p className="mt-2 text-xs text-gray-500 dark:text-stone-500">
          Got a code from a friend? Paste it above — no account needed.
        </p>
      </div>

      <div className="mt-8">
        {initialLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : knownTrips.length === 0 ? (
          <EmptyState
            icon="🧳"
            title="No trips yet"
            description="Create your first trip gallery, or join one with an invite code from a friend."
            action={
              <Link to="/trips/create">
                <Button>Create a trip</Button>
              </Link>
            }
          />
        ) : (
          <>
            <section aria-label="Trips you own">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-stone-100">
                Trips you own{' '}
                <span className="ml-1 text-sm font-normal text-gray-500 dark:text-stone-500">
                  ({owned.length})
                </span>
              </h2>
              {owned.length === 0 ? (
                <div className="mt-3">
                  <EmptyState
                    icon="📸"
                    title="You haven't created any trips yet"
                    description="Start a gallery for your next adventure — it takes seconds."
                    action={
                      <Link to="/trips/create">
                        <Button size="sm">Create a trip</Button>
                      </Link>
                    }
                  />
                </div>
              ) : (
                <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {owned.map((entry) => (
                    <TripCard
                      key={entry.known.tripId}
                      entry={entry}
                      onRemove={(tripId, name) => setRemoveTarget({ tripId, name })}
                      onLeave={(tripId, name, sessionId) => setLeaveTarget({ tripId, name, sessionId })}
                    />
                  ))}
                </div>
              )}
            </section>

            <section aria-label="Trips you're in" className="mt-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-stone-100">
                Trips you&apos;re in{' '}
                <span className="ml-1 text-sm font-normal text-gray-500 dark:text-stone-500">
                  ({memberOf.length})
                </span>
              </h2>
              {memberOf.length === 0 ? (
                <div className="mt-3">
                  <EmptyState
                    icon="✉️"
                    title="You haven't joined any trips yet"
                    description="When a friend shares an invite code, paste it above to join their gallery."
                  />
                </div>
              ) : (
                <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {memberOf.map((entry) => (
                    <TripCard
                      key={entry.known.tripId}
                      entry={entry}
                      onRemove={(tripId, name) => setRemoveTarget({ tripId, name })}
                      onLeave={(tripId, name, sessionId) => setLeaveTarget({ tripId, name, sessionId })}
                    />
                  ))}
                </div>
              )}
            </section>

            {stale.length > 0 && (
              <section aria-label="Unavailable trips" className="mt-8">
                <h2 className="text-sm font-medium text-gray-500 dark:text-stone-500">
                  Unavailable
                </h2>
                <div className="mt-3 grid gap-4 opacity-70 sm:grid-cols-2 lg:grid-cols-3">
                  {stale.map((entry) => (
                    <TripCard
                      key={entry.known.tripId}
                      entry={entry}
                      onRemove={(tripId, name) => setRemoveTarget({ tripId, name })}
                      onLeave={(tripId, name, sessionId) => setLeaveTarget({ tripId, name, sessionId })}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Remove from list — local only, never leaves or deletes */}
      <ConfirmDialog
        open={removeTarget !== null}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={confirmRemove}
        title="Remove from your list?"
        message={
          removeTarget
            ? `Remove “${removeTarget.name}” from your trips list on this device? You’ll stay a member — this doesn’t leave the trip or delete anything.`
            : ''
        }
        confirmLabel="Remove"
      />

      {/* Leave trip — ends membership */}
      <ConfirmDialog
        open={leaveTarget !== null}
        onCancel={() => setLeaveTarget(null)}
        onConfirm={() => void confirmLeave()}
        title="Leave this trip?"
        message={
          leaveTarget
            ? `Leave “${leaveTarget.name}”? You’ll lose access to the gallery and will need a new invite to rejoin.`
            : ''
        }
        confirmLabel="Leave trip"
        danger
        loading={leaving}
      />
    </PageContainer>
  );
}
