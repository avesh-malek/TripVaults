import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageContainer } from '../components/ui/PageContainer';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';

const STEPS = [
  {
    title: 'Create a trip',
    text: 'Name your trip and choose how long the gallery stays open — from a few hours to 14 days. You get one invite link.',
  },
  {
    title: 'Friends join with the link',
    text: 'No accounts, no app to install. Anyone with the link joins in seconds, straight from their phone.',
  },
  {
    title: 'Everyone uploads, on schedule',
    text: 'Photos and videos land in one shared gallery in original quality. When time runs out, the gallery expires — download everything as a ZIP before it does.',
  },
];

const FEATURES = [
  { title: 'Temporary by design', text: 'Galleries live for hours or days, then expire. No feeds, no clutter left behind.' },
  { title: 'No accounts or logins', text: 'An invite link and a name is all anyone needs to join and contribute.' },
  { title: 'Original quality', text: 'Uploads stay full-resolution, with a compressed option for slower connections.' },
  { title: 'One ZIP for everything', text: 'Select photos, filter by person, and download the whole gallery in one go.' },
];

export function Landing() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');

  const joinWithCode = () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed) navigate(`/join/${trimmed}`);
  };

  return (
    <div>
      {/* Hero */}
      <section>
        <PageContainer className="pb-14 pt-14 text-center sm:pb-20 sm:pt-20">
          <div className="flex justify-center">
            <Badge color="teal">Temporary shared galleries</Badge>
          </div>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-stone-100">
            All your trip memories. In one place.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-600 dark:text-stone-400">
            TripVault gives every trip a shared gallery with an expiry date. Everyone uploads
            their photos and videos — no accounts, no group-chat chaos, no lost memories.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/trips/create" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto">
                Create a trip
              </Button>
            </Link>
            <Link to="/dashboard" className="w-full sm:w-auto">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                My trips
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-gray-400 dark:text-stone-500">
            Free for galleries up to 14 days · No account needed
          </p>

          {/* Invite code — quiet tertiary action */}
          <div className="mx-auto mt-8 flex w-full max-w-xs items-center gap-2">
            <Input
              placeholder="Have an invite code?"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') joinWithCode();
              }}
              aria-label="Invite code"
              className="flex-1"
            />
            <Button variant="ghost" onClick={joinWithCode} disabled={!code.trim()}>
              Join
            </Button>
          </div>
        </PageContainer>
      </section>

      {/* How it works */}
      <section className="border-t border-gray-200 dark:border-stone-800">
        <PageContainer>
          <h2 className="text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-stone-100">
            How it works
          </h2>
          <p className="mx-auto mt-2 max-w-md text-center text-sm text-gray-500 dark:text-stone-500">
            From idea to shared gallery in under a minute.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900"
              >
                <p className="text-sm font-bold tabular-nums text-teal-600 dark:text-teal-400">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-2 font-semibold text-gray-900 dark:text-stone-100">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-stone-400">
                  {step.text}
                </p>
              </div>
            ))}
          </div>
        </PageContainer>
      </section>

      {/* What makes it different */}
      <section className="border-t border-gray-200 dark:border-stone-800">
        <PageContainer>
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-stone-100">
              Made for trips, not feeds
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900"
                >
                  <p className="flex items-center gap-2 font-semibold text-gray-900 dark:text-stone-100">
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700 dark:bg-teal-950 dark:text-teal-300"
                      aria-hidden
                    >
                      ✓
                    </span>
                    {f.title}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-stone-400">
                    {f.text}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link to="/trips/create">
                <Button size="lg">Start your trip gallery</Button>
              </Link>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-stone-800">
        <PageContainer className="py-6">
          <p className="text-center text-xs text-gray-400 dark:text-stone-500">
            TripVault — temporary shared galleries for trips &amp; events.
          </p>
        </PageContainer>
      </footer>
    </div>
  );
}
