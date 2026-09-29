import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  FREE_AVAILABILITY_OPTIONS,
  GALLERY_PAGE_SIZE,
  SESSION_HEADER,
} from '@tripvault/shared';
import type { GalleryFilter, MediaListItem, TripDetailResponse } from '@tripvault/shared';
import { PageContainer } from '../components/ui/PageContainer';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { MediaGrid } from '../components/MediaGrid';
import { PreviewModal } from '../components/PreviewModal';
import { SelectionBar } from '../components/SelectionBar';
import { UploadPanel } from '../components/UploadPanel';
import { MembersPanel } from '../components/MembersPanel';
import { SettingsPanel } from '../components/SettingsPanel';
import { ExpiryBanner } from '../components/ExpiryBanner';
import { InviteLinkBox } from '../components/InviteLinkBox';
import { API_BASE, ApiError, api } from '../lib/api';
import { findKnownTrip, getSessionId, removeKnownTrip } from '../lib/session';
import { expiresLabel, formatDate } from '../lib/format';

type Tab = 'gallery' | 'upload' | 'members' | 'settings';

const FILTERS: { value: GalleryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'photos', label: 'Photos' },
  { value: 'videos', label: 'Videos' },
  { value: 'mine', label: 'My Uploads' },
];

export function TripGallery() {
  const { tripId = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [sessionId] = useState(() => getSessionId(tripId));
  const [tab, setTab] = useState<Tab>('gallery');
  const [filter, setFilter] = useState<GalleryFilter>('all');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewItem, setPreviewItem] = useState<MediaListItem | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [extendDays, setExtendDays] = useState(7);

  const detailQuery = useQuery({
    queryKey: ['trip-detail', tripId],
    queryFn: () => api<TripDetailResponse>(`/trips/${tripId}`, { sessionId }),
    retry: 1,
  });

  const detail = detailQuery.data;
  const isOwner = detail?.isOwner ?? false;

  // Not a member → send them to the invite flow when we know the code.
  useEffect(() => {
    const err = detailQuery.error;
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      const known = findKnownTrip(tripId);
      if (known?.inviteCode) {
        navigate(`/join/${known.inviteCode}`, { replace: true });
      }
    }
  }, [detailQuery.error, navigate, tripId]);

  const mediaQuery = useInfiniteQuery({
    queryKey: ['media', tripId, filter],
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      api<{ items: MediaListItem[]; nextCursor: string | null }>(`/trips/${tripId}/media`, {
        sessionId,
        query: { filter, limit: GALLERY_PAGE_SIZE, cursor: pageParam ?? undefined },
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!detail && detail.trip.status !== 'expired' && detail.trip.status !== 'deleted',
  });

  const items = useMemo(
    () => mediaQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [mediaQuery.data],
  );

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['trip-detail', tripId] });
    void queryClient.invalidateQueries({ queryKey: ['media', tripId] });
  };

  const extendMutation = useMutation({
    mutationFn: () =>
      api(`/trips/${tripId}/extend`, {
        method: 'POST',
        sessionId,
        body: { additionalDays: extendDays },
      }),
    onSuccess: () => {
      toast.success('Gallery extended — enjoy the extra days!');
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message || 'Could not extend the gallery'),
  });

  const handleLeft = () => {
    removeKnownTrip(tripId);
    navigate('/dashboard', { replace: true });
  };

  const handleDeleted = () => {
    removeKnownTrip(tripId);
    navigate('/dashboard', { replace: true });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkDownload = async () => {
    if (selectedIds.size === 0) return;
    setBulkDownloading(true);
    try {
      const res = await fetch(`${API_BASE}/trips/${tripId}/media/bulk-download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', [SESSION_HEADER]: sessionId },
        body: JSON.stringify({ mediaIds: [...selectedIds] }),
      });
      if (!res.ok) {
        let message = `Download failed (status ${res.status})`;
        try {
          const body = (await res.json()) as { error?: { message?: string } };
          if (body.error?.message) message = body.error.message;
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const disposition = res.headers.get('content-disposition');
      const match = disposition?.match(/filename="?([^";]+)"?/);
      const a = document.createElement('a');
      a.href = url;
      a.download = match?.[1] ?? `${detail?.trip.name ?? 'trip'}-photos.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success('Your ZIP download has started');
      setSelectedIds(new Set());
      setSelectionMode(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setBulkDownloading(false);
    }
  };

  /* ------------------------------ states ------------------------------ */

  if (detailQuery.isLoading) {
    return (
      <PageContainer>
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      </PageContainer>
    );
  }

  if (detailQuery.isError) {
    const err = detailQuery.error;
    const notMember = err instanceof ApiError && (err.status === 401 || err.status === 403);
    return (
      <PageContainer className="max-w-xl">
        <div className="mt-8">
          <EmptyState
            icon={notMember ? '🚪' : '⚠️'}
            title={notMember ? "You're not a member of this trip" : 'Could not load this trip'}
            description={
              notMember
                ? 'Ask the trip owner for a fresh invite link to join the gallery.'
                : err instanceof Error ? err.message : 'Please try again in a moment.'
            }
            action={
              <div className="flex gap-2">
                <Link to="/dashboard"><Button variant="secondary">My trips</Button></Link>
                <Button variant="ghost" onClick={() => detailQuery.refetch()}>Retry</Button>
              </div>
            }
          />
        </div>
      </PageContainer>
    );
  }

  if (!detail) return null;
  const { trip, memberCount, photoCount, videoCount, myMember, expiresInDays } = detail;

  if (trip.status === 'deleted') {
    return (
      <PageContainer className="max-w-xl">
        <div className="mt-8">
          <EmptyState
            icon="🗑️"
            title="This trip has been deleted"
            description="The gallery and all its media are gone for good."
            action={<Link to="/dashboard"><Button variant="secondary">My trips</Button></Link>}
          />
        </div>
      </PageContainer>
    );
  }

  /* ------------------------------ expired ------------------------------ */
  if (trip.status === 'expired') {
    return (
      <PageContainer className="max-w-xl">
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 text-center sm:p-8">
          <div className="text-4xl">⏳</div>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">This gallery has expired</h1>
          <p className="mt-2 text-sm text-gray-600">
            <span className="font-medium">{trip.name}</span> ran its course. Its photos and videos
            are no longer available.
          </p>
          {isOwner && (
            <div className="mt-6 rounded-xl bg-indigo-50 p-4">
              <p className="text-sm font-medium text-gray-900">Bring it back for a few more days?</p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <select
                  value={extendDays}
                  onChange={(e) => setExtendDays(Number(e.target.value))}
                  aria-label="Additional days"
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  {FREE_AVAILABILITY_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      +{d} day{d === 1 ? '' : 's'}
                    </option>
                  ))}
                </select>
                <Button loading={extendMutation.isPending} onClick={() => extendMutation.mutate()}>
                  Extend gallery
                </Button>
              </div>
              <p className="mt-2 text-xs text-gray-500">Free plan: up to 14 days total from creation.</p>
            </div>
          )}
          <div className="mt-6">
            <Link to="/dashboard"><Button variant="secondary">My trips</Button></Link>
          </div>
        </div>
      </PageContainer>
    );
  }

  const tabs: { value: Tab; label: string }[] = [
    { value: 'gallery', label: 'Gallery' },
    { value: 'upload', label: 'Upload' },
    { value: 'members', label: 'Members' },
    ...(isOwner ? [{ value: 'settings' as Tab, label: 'Settings' }] : []),
  ];

  const inGrace = trip.status === 'grace_period';

  return (
    <div className="pb-24">
      <PageContainer>
        {/* Trip header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{trip.name}</h1>
              {inGrace && <Badge color="amber">Expired — downloads only</Badge>}
              {trip.status === 'expiring_soon' && <Badge color="amber">Expiring soon</Badge>}
            </div>
            {trip.description && <p className="mt-1 max-w-2xl text-sm text-gray-600">{trip.description}</p>}
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
              <span>{memberCount} member{memberCount === 1 ? '' : 's'}</span>
              <span>{photoCount} photo{photoCount === 1 ? '' : 's'}</span>
              <span>{videoCount} video{videoCount === 1 ? '' : 's'}</span>
              <span className="font-medium text-gray-700">{expiresLabel(expiresInDays)}</span>
              {trip.status === 'grace_period' && <span>· available until {formatDate(trip.expires_at)}</span>}
            </p>
          </div>
          <Button variant="secondary" onClick={() => setInviteOpen(true)}>
            🔗 Invite
          </Button>
        </div>

        {!inGrace && <div className="mt-4"><ExpiryBanner expiresInDays={expiresInDays} /></div>}
        {inGrace && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            ⏳ This gallery has expired — you can still view and download media, but no new uploads.
          </div>
        )}

        {/* Tabs */}
        <div className="mt-4 border-b border-gray-200">
          <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Trip sections">
            {tabs.map((t) => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  tab === t.value
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-5">
          {tab === 'gallery' && (
            <div>
              {/* Filter + selection controls */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
                  {FILTERS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setFilter(f.value)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        filter === f.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                {items.length > 0 && (
                  <Button
                    variant={selectionMode ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => {
                      setSelectionMode((v) => !v);
                      setSelectedIds(new Set());
                    }}
                  >
                    {selectionMode ? 'Done selecting' : 'Select'}
                  </Button>
                )}
              </div>

              {mediaQuery.isLoading ? (
                <div className="flex justify-center py-16"><Spinner size="lg" /></div>
              ) : mediaQuery.isError ? (
                <EmptyState
                  title="Couldn't load the gallery"
                  description="Please try again in a moment."
                  action={<Button variant="secondary" onClick={() => mediaQuery.refetch()}>Retry</Button>}
                />
              ) : items.length === 0 ? (
                <EmptyState
                  icon="📸"
                  title={filter === 'all' ? 'No photos yet' : 'Nothing here yet'}
                  description={
                    filter === 'all'
                      ? 'Be the first to add memories to this trip!'
                      : 'Try a different filter, or upload something new.'
                  }
                  action={
                    !inGrace ? <Button onClick={() => setTab('upload')}>Upload photos</Button> : undefined
                  }
                />
              ) : (
                <MediaGrid
                  items={items}
                  selectedIds={selectedIds}
                  selectionMode={selectionMode}
                  hasNextPage={!!mediaQuery.hasNextPage}
                  isFetchingNextPage={mediaQuery.isFetchingNextPage}
                  onLoadMore={() => mediaQuery.fetchNextPage()}
                  onPreview={setPreviewItem}
                  onToggleSelect={toggleSelect}
                />
              )}
            </div>
          )}

          {tab === 'upload' && (
            inGrace ? (
              <EmptyState
                icon="⏳"
                title="Uploads are closed"
                description="This gallery has expired — you can still view and download everything."
                action={<Button variant="secondary" onClick={() => setTab('gallery')}>Back to gallery</Button>}
              />
            ) : (
              <UploadPanel tripId={tripId} sessionId={sessionId} onUploaded={refreshAll} />
            )
          )}

          {tab === 'members' && (
            <MembersPanel
              tripId={tripId}
              sessionId={sessionId}
              isOwner={isOwner}
              myMemberId={myMember.id}
              onLeft={handleLeft}
            />
          )}

          {tab === 'settings' && isOwner && (
            <SettingsPanel
              detail={detail}
              sessionId={sessionId}
              onUpdated={refreshAll}
              onDeleted={handleDeleted}
            />
          )}
        </div>
      </PageContainer>

      {selectionMode && selectedIds.size > 0 && (
        <SelectionBar
          count={selectedIds.size}
          downloading={bulkDownloading}
          onDownload={() => void bulkDownload()}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      <PreviewModal
        item={previewItem}
        tripId={tripId}
        sessionId={sessionId}
        myMemberId={myMember.id}
        onClose={() => setPreviewItem(null)}
        onDeleted={refreshAll}
      />

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite friends">
        <InviteLinkBox inviteCode={trip.invite_code} compact />
        <p className="mt-3 text-xs text-gray-500">
          Anyone with this link can {trip.access_type === 'open' ? 'join instantly' : 'request to join'} — no account needed.
        </p>
      </Modal>
    </div>
  );
}
