import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { FREE_AVAILABILITY_OPTIONS, PREMIUM_AVAILABILITY_OPTIONS } from '@tripvault/shared';
import type { AccessType, CreateTripResponse } from '@tripvault/shared';
import { PageContainer } from '../components/ui/PageContainer';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { api } from '../lib/api';
import { addKnownTrip, setSessionId } from '../lib/session';

export function CreateTrip() {
  const navigate = useNavigate();
  const toast = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [availabilityDays, setAvailabilityDays] = useState<number>(7);
  const [accessType, setAccessType] = useState<AccessType>('open');
  const [ownerName, setOwnerName] = useState('');
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; ownerName?: string }>({});

  const createMutation = useMutation({
    mutationFn: (sessionId: string) =>
      api<CreateTripResponse>('/trips', {
        method: 'POST',
        sessionId,
        body: {
          name: name.trim(),
          description: description.trim() || undefined,
          availabilityDays,
          accessType,
          ownerName: ownerName.trim(),
        },
      }),
    onSuccess: (data, sessionId) => {
      setSessionId(data.trip.id, sessionId);
      addKnownTrip({
        tripId: data.trip.id,
        inviteCode: data.trip.invite_code,
        name: data.trip.name,
        sessionId,
      });
      toast.success('Trip created — share the invite link with your crew!');
      navigate(`/trips/${data.trip.id}`);
    },
    onError: (e: Error) => toast.error(e.message || 'Could not create the trip'),
  });

  const submit = () => {
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = 'Give your trip a name (at least 2 characters).';
    if (ownerName.trim().length < 1) next.ownerName = 'Tell everyone who you are.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    createMutation.mutate(crypto.randomUUID());
  };

  return (
    <PageContainer className="max-w-2xl">
      <Link to="/" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
        ← Back
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">Create a trip gallery</h1>
      <p className="mt-1 text-sm text-gray-500">
        Set it up in under a minute — then share one link with everyone.
      </p>

      <div className="mt-6 space-y-6 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <Input
          label="Trip name"
          placeholder="e.g. Goa with the college gang"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />

        <div>
          <label htmlFor="create-description" className="mb-1.5 block text-sm font-medium text-gray-700">
            Description <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <textarea
            id="create-description"
            value={description}
            maxLength={500}
            rows={3}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Beaches, bikes, and way too much seafood…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-gray-700">
            How long should your trip gallery stay available?
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FREE_AVAILABILITY_OPTIONS.map((days) => (
              <label
                key={days}
                className={`cursor-pointer rounded-xl border p-3 text-center transition-colors ${
                  availabilityDays === days
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="availability"
                  className="sr-only"
                  checked={availabilityDays === days}
                  onChange={() => setAvailabilityDays(days)}
                />
                <span className="block text-lg font-semibold text-gray-900">{days}</span>
                <span className="block text-xs text-gray-500">day{days === 1 ? '' : 's'}</span>
              </label>
            ))}
          </div>

          {/* Locked premium section */}
          <div className="mt-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              🔒 Premium
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2 opacity-60">
              {[...PREMIUM_AVAILABILITY_OPTIONS.map(String), 'Forever'].map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setPremiumOpen(true)}
                  className="rounded-xl border border-gray-200 bg-white p-3 text-center"
                >
                  <span className="block text-sm font-semibold text-gray-500">🔒 {label}</span>
                  <span className="block text-xs text-gray-400">{label === 'Forever' ? 'never expires' : 'days'}</span>
                </button>
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-gray-700">Who can join?</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label
              className={`cursor-pointer rounded-xl border p-3 ${
                accessType === 'open' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="access"
                  checked={accessType === 'open'}
                  onChange={() => setAccessType('open')}
                  className="h-4 w-4 accent-indigo-600"
                />
                <span className="text-sm font-medium text-gray-900">Anyone with the invite link</span>
              </div>
              <p className="mt-1 pl-6 text-xs text-gray-500">Fastest — friends join instantly.</p>
            </label>
            <label
              className={`cursor-pointer rounded-xl border p-3 ${
                accessType === 'approval' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="access"
                  checked={accessType === 'approval'}
                  onChange={() => setAccessType('approval')}
                  className="h-4 w-4 accent-indigo-600"
                />
                <span className="text-sm font-medium text-gray-900">Request to join</span>
              </div>
              <p className="mt-1 pl-6 text-xs text-gray-500">You approve each person who asks to join.</p>
            </label>
          </div>
        </fieldset>

        <Input
          label="Your name"
          placeholder="What should everyone call you?"
          value={ownerName}
          maxLength={50}
          onChange={(e) => setOwnerName(e.target.value)}
          error={errors.ownerName}
          hint="This is shown as the trip owner and on everything you upload."
        />

        <Button size="lg" className="w-full" loading={createMutation.isPending} onClick={submit}>
          Create trip gallery
        </Button>
      </div>

      <Modal open={premiumOpen} onClose={() => setPremiumOpen(false)} title="Premium feature">
        <p className="text-sm text-gray-600">
          Longer galleries are coming soon. Free plan includes galleries up to 14 days —
          plenty for most trips. ✈️
        </p>
        <div className="mt-5 flex justify-end">
          <Button onClick={() => setPremiumOpen(false)}>Got it</Button>
        </div>
      </Modal>
    </PageContainer>
  );
}
