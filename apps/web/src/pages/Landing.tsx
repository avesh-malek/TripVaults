import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageContainer } from '../components/ui/PageContainer';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

const STEPS = [
  { icon: '🧳', title: 'Create a trip', text: 'Name your trip and pick how long the gallery stays available — up to 14 days free.' },
  { icon: '🔗', title: 'Share the link', text: 'Send one invite link to your travel buddies. No accounts, no app to install.' },
  { icon: '📸', title: 'Everyone uploads', text: 'Friends add their photos and videos straight from their phones, in original quality.' },
  { icon: '💾', title: 'Keep the memories', text: 'Download everything as a ZIP before the gallery expires. Simple as that.' },
];

const FEATURES = [
  'No sign-ups — join with a link and a name',
  'Original-quality uploads, plus a compressed option',
  'Shared gallery with photos, videos & thumbnails',
  'Bulk download everything as one ZIP',
  'Galleries auto-expire — no digital clutter left behind',
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
      <section className="bg-gradient-to-b from-indigo-50 to-white">
        <PageContainer className="pb-12 pt-14 text-center sm:pt-20">
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            All your trip memories. In one place.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-600">
            TripVault gives every trip a temporary shared gallery. Everyone uploads their photos
            and videos — no accounts, no group-chat chaos, no lost memories.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/trips/create">
              <Button size="lg">Create a Trip</Button>
            </Link>
            <div className="flex w-full max-w-xs gap-2 sm:w-auto">
              <Input
                placeholder="Invite code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') joinWithCode();
                }}
                aria-label="Invite code"
                className="flex-1"
              />
              <Button variant="secondary" size="lg" onClick={joinWithCode} disabled={!code.trim()}>
                Join a Trip
              </Button>
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-400">Free for galleries up to 14 days · No account needed</p>
        </PageContainer>
      </section>

      {/* How it works */}
      <section className="bg-white">
        <PageContainer>
          <h2 className="text-center text-2xl font-bold text-gray-900">How it works</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <div key={step.title} className="rounded-2xl border border-gray-200 bg-gray-50/50 p-5">
                <div className="text-3xl">{step.icon}</div>
                <p className="mt-3 text-sm font-semibold text-indigo-600">Step {i + 1}</p>
                <h3 className="mt-1 font-semibold text-gray-900">{step.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{step.text}</p>
              </div>
            ))}
          </div>
        </PageContainer>
      </section>

      {/* Features */}
      <section>
        <PageContainer>
          <div className="mx-auto max-w-2xl rounded-2xl bg-gray-900 p-6 text-white sm:p-8">
            <h2 className="text-xl font-bold">Made for trips, not feeds</h2>
            <ul className="mt-4 space-y-2.5">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-gray-200">
                  <span className="text-green-400">✓</span> {f}
                </li>
              ))}
            </ul>
            <Link to="/trips/create" className="mt-6 inline-block">
              <Button size="lg">Start your trip gallery</Button>
            </Link>
          </div>
        </PageContainer>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200">
        <PageContainer className="py-6">
          <p className="text-center text-xs text-gray-400">
            TripVault — temporary shared galleries for trips & events.
          </p>
        </PageContainer>
      </footer>
    </div>
  );
}
