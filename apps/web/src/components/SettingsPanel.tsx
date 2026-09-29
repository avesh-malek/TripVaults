import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { AccessType, Trip, TripDetailResponse } from '@tripvault/shared';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { useToast } from './ui/Toast';
import { InviteLinkBox } from './InviteLinkBox';
import { api } from '../lib/api';
import { expiresLabel } from '../lib/format';

export interface SettingsPanelProps {
  detail: TripDetailResponse;
  sessionId: string;
  onUpdated: () => void;
  onDeleted: () => void;
}

export function SettingsPanel({ detail, sessionId, onUpdated, onDeleted }: SettingsPanelProps) {
  const toast = useToast();
  const { trip, expiresInHours } = detail;

  const [name, setName] = useState(trip.name);
  const [description, setDescription] = useState(trip.description ?? '');
  const [accessType, setAccessType] = useState<AccessType>(trip.access_type);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty =
    name.trim() !== trip.name ||
    description.trim() !== (trip.description ?? '') ||
    accessType !== trip.access_type;

  const saveMutation = useMutation({
    mutationFn: () =>
      api<{ trip: Trip }>(`/trips/${trip.id}`, {
        method: 'PATCH',
        sessionId,
        body: {
          name: name.trim(),
          description: description.trim() ? description.trim() : null,
          accessType,
        },
      }),
    onSuccess: () => {
      toast.success('Trip settings saved');
      onUpdated();
    },
    onError: (e: Error) => toast.error(e.message || 'Could not save settings'),
  });

  const closeMutation = useMutation({
    mutationFn: () => api<{ trip: Trip }>(`/trips/${trip.id}/close`, { method: 'POST', sessionId }),
    onSuccess: () => {
      toast.info('Trip closed — the gallery is now expired');
      setConfirmClose(false);
      onUpdated();
    },
    onError: (e: Error) => toast.error(e.message || 'Could not close the trip'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api<{ deleted: true }>(`/trips/${trip.id}`, { method: 'DELETE', sessionId }),
    onSuccess: () => {
      toast.info('Trip deleted');
      setConfirmDelete(false);
      onDeleted();
    },
    onError: (e: Error) => toast.error(e.message || 'Could not delete the trip'),
  });

  return (
    <div className="space-y-4">
      {/* General */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-stone-800 dark:bg-stone-900">
        <h3 className="text-base font-semibold text-gray-900 dark:text-stone-100">Trip settings</h3>
        <div className="mt-4 space-y-4">
          <Input
            label="Trip name"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
          <div>
            <label htmlFor="trip-description" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-stone-300">
              Description <span className="font-normal text-gray-400 dark:text-stone-500">(optional)</span>
            </label>
            <textarea
              id="trip-description"
              value={description}
              maxLength={500}
              rows={3}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Where did you go? What happened?"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder-stone-500"
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700 dark:text-stone-300">Who can join?</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label
                className={`cursor-pointer rounded-xl border p-3 ${
                  accessType === 'open'
                    ? 'border-teal-500 bg-teal-50 dark:border-teal-400 dark:bg-teal-950'
                    : 'border-gray-200 dark:border-stone-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="access-type"
                    checked={accessType === 'open'}
                    onChange={() => setAccessType('open')}
                    className="h-4 w-4 accent-teal-600"
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-stone-100">Anyone with the invite link</span>
                </div>
              </label>
              <label
                className={`cursor-pointer rounded-xl border p-3 ${
                  accessType === 'approval'
                    ? 'border-teal-500 bg-teal-50 dark:border-teal-400 dark:bg-teal-950'
                    : 'border-gray-200 dark:border-stone-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="access-type"
                    checked={accessType === 'approval'}
                    onChange={() => setAccessType('approval')}
                    className="h-4 w-4 accent-teal-600"
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-stone-100">Request to join</span>
                </div>
              </label>
            </div>
          </div>
          <Button
            disabled={!dirty || name.trim().length === 0}
            loading={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            Save changes
          </Button>
        </div>
      </section>

      {/* Availability */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-stone-800 dark:bg-stone-900">
        <h3 className="text-base font-semibold text-gray-900 dark:text-stone-100">Availability</h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-stone-400">
          <span className="font-medium text-gray-900 dark:text-stone-100">{expiresLabel(expiresInHours)}</span>
          {' '}— the gallery and all its media are deleted after that.
        </p>
        <div className="mt-3">
          <InviteLinkBox inviteCode={trip.invite_code} />
        </div>
      </section>

      {/* Danger zone */}
      <section className="rounded-2xl border border-red-200 bg-red-50/50 p-4 sm:p-5 dark:border-red-900 dark:bg-red-950/40">
        <h3 className="text-base font-semibold text-red-800 dark:text-red-300">Danger zone</h3>
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-stone-100">Close trip</p>
              <p className="text-xs text-gray-500 dark:text-stone-400">Expire the gallery now. Members can still view it until it&apos;s deleted.</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setConfirmClose(true)}>
              Close trip
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-red-100 pt-3 dark:border-red-900">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-stone-100">Delete trip</p>
              <p className="text-xs text-gray-500 dark:text-stone-400">Permanently delete the gallery and every photo and video in it.</p>
            </div>
            <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
              Delete trip
            </Button>
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={confirmClose}
        onCancel={() => setConfirmClose(false)}
        onConfirm={() => closeMutation.mutate()}
        title="Close this trip?"
        message="The gallery will expire immediately. This can't be undone, but members can still download media until it's deleted."
        confirmLabel="Close trip"
        danger
        loading={closeMutation.isPending}
      />
      <ConfirmDialog
        open={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete this trip?"
        message="This permanently deletes the gallery and every photo and video in it, for everyone. This can't be undone."
        confirmLabel="Delete forever"
        danger
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
