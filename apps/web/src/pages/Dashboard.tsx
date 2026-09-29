import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import type { TripDetailResponse } from '@tripvault/shared';
import { PageContainer } from '../components/ui/PageContainer';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { api } from '../lib/api';
import { getKnownTrips, removeKnownTrip } from '../lib/session';
import { expiresLabel } from '../lib/format';

export function Dashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const [knownTrips, setKnownTrips] = useState(getKnownTrips);
  const [code, setCode] = useState('');

  const detailQueries = useQueries({
    queries: knownTrips.map((t) => ({
      queryKey: ['trip-detail', t.tripId],
      queryFn: () => api<TripDetailResponse>(`/trips/${t.tripId}`, { sessionId: t.sessionId }),
      retry: 1,
      staleTime: 1000 * 60,
    })),
  });

  const forget = (tripId: string, name: string) => {
    removeKnownTrip(tripId);
    setKnownTrips(getKnownTrips());
    toast.info(`Removed “${name}” from your list`);
  };

  const joinWithCode = () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed) navigate(`/join/${trimmed}`);
  };

  const loading = detailQueries.some((q) => q.isLoading);

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">My trips</h1>
          <p className="mt-1 text-sm text-gray-500">
            Every trip gallery you've created or joined on this device.
          </p>
        </div>
        <Link to="/trips/create"><Button>+ New Trip</Button></Link>
      </div>

      {/* Join by code */}
      <div className="mt-5 flex gap-2 rounded-2xl border border-gray-200 bg-white p-4">
        <Input
          placeholder="Have an invite code? Enter it here"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') joinWithCode();
          }}
          aria-label="Invite code"
          className="flex-1"
        />
        <Button variant="secondary" onClick={joinWithCode} disabled={!code.trim()} className="shrink-0">
          Join
        </Button>
      </div>

      <div className="mt-5">
        {loading && knownTrips.length > 0 && (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        )}

        {!loading && knownTrips.length === 0 && (
          <EmptyState
            icon="🧳"
            title="No trips yet"
            description="Create your first trip gallery, or join one with an invite code from a friend."
            action={<Link to="/trips/create"><Button>Create a trip</Button></Link>}
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {knownTrips.map((t, i) => {
            const q = detailQueries[i];
            const detail = q?.data;
            const gone = q?.isError;
            return (
              <div
                key={t.tripId}
                className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="truncate text-lg font-semibold text-gray-900">
                    {detail?.trip.name ?? t.name}
                  </h2>
                  {detail && (
                    <Badge color={detail.trip.status === 'active' ? 'green' : 'amber'}>
                      {detail.trip.status === 'active' ? expiresLabel(detail.expiresInDays) : detail.trip.status.replace('_', ' ')}
                    </Badge>
                  )}
                </div>

                {q?.isLoading ? (
                  <div className="flex flex-1 items-center justify-center py-6"><Spinner /></div>
                ) : gone || !detail ? (
                  <p className="flex-1 py-4 text-sm text-gray-500">
                    Couldn't load this trip — it may have expired or been deleted.
                  </p>
                ) : (
                  <p className="mt-1 flex-1 text-sm text-gray-500">
                    {detail.memberCount} member{detail.memberCount === 1 ? '' : 's'} ·{' '}
                    {detail.photoCount + detail.videoCount} file{detail.photoCount + detail.videoCount === 1 ? '' : 's'}
                    {detail.isOwner && ' · you own this trip'}
                  </p>
                )}

                <div className="mt-4 flex gap-2">
                  {!gone && detail && (
                    <Link to={`/trips/${t.tripId}`} className="flex-1">
                      <Button className="w-full" size="sm">Open</Button>
                    </Link>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => forget(t.tripId, detail?.trip.name ?? t.name)}
                    className="!text-gray-400 hover:!bg-gray-100 hover:!text-gray-600"
                    aria-label={`Remove ${detail?.trip.name ?? t.name} from list`}
                  >
                    ✕
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PageContainer>
  );
}
