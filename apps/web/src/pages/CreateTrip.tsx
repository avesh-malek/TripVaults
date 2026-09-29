import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  FREE_AVAILABILITY_HOURS,
  FREE_AVAILABILITY_OPTIONS,
  PREMIUM_AVAILABILITY_OPTIONS,
} from '@tripvault/shared';
import type { AccessType, CreateTripResponse } from '@tripvault/shared';
import { PageContainer } from '../components/ui/PageContainer';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { api } from '../lib/api';
import { addKnownTrip, setSessionId } from '../lib/session';

const HOURS_PER_DAY = 24;

interface DurationOption {
  value: number;
  unit: string;
}

const HOUR_OPTIONS: DurationOption[] = FREE_AVAILABILITY_HOURS.map((h) => ({
  value: h,
  unit: h === 1 ? 'hour' : 'hours',
}));
const DAY_OPTIONS: DurationOption[] = FREE_AVAILABILITY_OPTIONS.map((d) => ({
  value: d * HOURS_PER_DAY,
  unit: d === 1 ? 'day' : 'days',
}));
const PREMIUM_OPTIONS: DurationOption[] = PREMIUM_AVAILABILITY_OPTIONS.map((d) => ({
  value: d * HOURS_PER_DAY,
  unit: 'days',
}));

function durationSummary(hours: number): string {
  if (hours < HOURS_PER_DAY) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = hours / HOURS_PER_DAY;
  return `${days} day${days === 1 ? '' : 's'}`;
}

function DurationTile({
  option,
  selected,
  onSelect,
  disabled = false,
}: {
  option: DurationOption;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  const display = option.value < HOURS_PER_DAY ? option.value : option.value / HOURS_PER_DAY;
  return (
    <label
      className={`rounded-xl border p-3 text-center transition-colors ${
        disabled
          ? 'cursor-pointer border-dashed border-gray-300 bg-gray-50 dark:border-stone-700 dark:bg-stone-800/50'
          : selected
            ? 'cursor-pointer border-teal-500 bg-teal-50 dark:border-teal-400 dark:bg-teal-950'
            : 'cursor-pointer border-gray-200 hover:border-gray-300 dark:border-stone-700 dark:hover:border-stone-600'
      }`}
    >
      <input
        type="radio"
        name="availability"
        className="sr-only"
        checked={selected}
        disabled={disabled}
        onChange={onSelect}
      />
      <span className="block text-lg font-semibold text-gray-900 dark:text-stone-100">
        {disabled ? '🔒 ' : ''}
        {display}
      </span>
      <span className="block text-xs text-gray-500 dark:text-stone-400">{option.unit}</span>
    </label>
  );
}

function DurationGroup({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-stone-400">
        {title}
        {hint && <span className="ml-1.5 font-normal normal-case tracking-normal">{hint}</span>}
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">{children}</div>
    </div>
  );
}

export function CreateTrip() {
  const navigate = useNavigate();
  const toast = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  // Duration in hours. Default: 7 days.
  const [availabilityHours, setAvailabilityHours] = useState<number>(7 * HOURS_PER_DAY);
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
          availabilityHours,
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

  const accessCard = (value: AccessType, title: string, blurb: string) => (
    <label
      className={`cursor-pointer rounded-xl border p-3 transition-colors ${
        accessType === value
          ? 'border-teal-500 bg-teal-50 dark:border-teal-400 dark:bg-teal-950'
          : 'border-gray-200 hover:border-gray-300 dark:border-stone-700 dark:hover:border-stone-600'
      }`}
    >
      <div className="flex items-center gap-2">
        <input
          type="radio"
          name="access"
          checked={accessType === value}
          onChange={() => setAccessType(value)}
          className="h-4 w-4 accent-teal-600 dark:accent-teal-400"
        />
        <span className="text-sm font-medium text-gray-900 dark:text-stone-100">{title}</span>
      </div>
      <p className="mt-1 pl-6 text-xs text-gray-500 dark:text-stone-400">{blurb}</p>
    </label>
  );

  return (
    <PageContainer className="max-w-2xl">
      <Link
        to="/"
        className="text-sm font-medium text-teal-700 hover:text-teal-900 dark:text-teal-300 dark:hover:text-teal-200"
      >
        ← Back
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-stone-100">
        Create a trip gallery
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-stone-400">
        Set it up in under a minute — then share one link with everyone.
      </p>

      <div className="mt-6 space-y-6 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 dark:border-stone-800 dark:bg-stone-900">
        <Input
          label="Trip name"
          placeholder="e.g. Goa with the college gang"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />

        <div>
          <label
            htmlFor="create-description"
            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-stone-300"
          >
            Description <span className="font-normal text-gray-400 dark:text-stone-500">(optional)</span>
          </label>
          <textarea
            id="create-description"
            value={description}
            maxLength={500}
            rows={3}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Beaches, bikes, and way too much seafood…"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder-stone-500"
          />
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-gray-700 dark:text-stone-300">
            How long should your trip gallery stay available?
          </legend>
          <div className="mt-3 space-y-4">
            <DurationGroup title="Quick trips" hint="perfect for a day out">
              {HOUR_OPTIONS.map((opt) => (
                <DurationTile
                  key={opt.value}
                  option={opt}
                  selected={availabilityHours === opt.value}
                  onSelect={() => setAvailabilityHours(opt.value)}
                />
              ))}
            </DurationGroup>
            <DurationGroup title="Days" hint="the classics">
              {DAY_OPTIONS.map((opt) => (
                <DurationTile
                  key={opt.value}
                  option={opt}
                  selected={availabilityHours === opt.value}
                  onSelect={() => setAvailabilityHours(opt.value)}
                />
              ))}
            </DurationGroup>
            <DurationGroup
              title="Longer"
              hint="premium — coming soon"
            >
              {[...PREMIUM_OPTIONS, { value: -1, unit: 'forever' }].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPremiumOpen(true)}
                  className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3 text-center transition-colors hover:border-gray-400 dark:border-stone-700 dark:bg-stone-800/50 dark:hover:border-stone-600"
                >
                  <span className="block text-lg font-semibold text-gray-400 dark:text-stone-500">
                    🔒 {opt.value === -1 ? '∞' : opt.value / HOURS_PER_DAY}
                  </span>
                  <span className="block text-xs text-gray-400 dark:text-stone-500">{opt.unit}</span>
                </button>
              ))}
            </DurationGroup>
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-stone-400">
            <Badge color="teal">Selected: {durationSummary(availabilityHours)}</Badge>
            Free plan covers up to 14 days from creation.
          </p>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-gray-700 dark:text-stone-300">Who can join?</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {accessCard('open', 'Anyone with the invite link', 'Fastest — friends join instantly.')}
            {accessCard('approval', 'Request to join', 'You approve each person who asks to join.')}
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
        <p className="text-sm text-gray-600 dark:text-stone-300">
          Longer galleries are coming soon. The free plan includes galleries up to 14 days —
          plenty for most trips. ✈️
        </p>
        <div className="mt-5 flex justify-end">
          <Button onClick={() => setPremiumOpen(false)}>Got it</Button>
        </div>
      </Modal>
    </PageContainer>
  );
}
