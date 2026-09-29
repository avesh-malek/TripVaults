import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { Header } from './components/ui/Header';
import { PageContainer } from './components/ui/PageContainer';
import { Landing } from './pages/Landing';
import { CreateTrip } from './pages/CreateTrip';
import { JoinTrip } from './pages/JoinTrip';
import { TripGallery } from './pages/TripGallery';
import { Dashboard } from './pages/Dashboard';
import { EmptyState } from './components/ui/EmptyState';
import { Button } from './components/ui/Button';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function NotFound() {
  return (
    <PageContainer className="max-w-xl">
      <div className="mt-8">
        <EmptyState
          icon="🧭"
          title="Page not found"
          description="This page doesn't exist — but your memories are safe elsewhere."
          action={<Link to="/"><Button>Go home</Button></Link>}
        />
      </div>
    </PageContainer>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-gray-50 text-gray-900 antialiased">
            <Header />
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/trips/create" element={<CreateTrip />} />
              <Route path="/join/:inviteCode" element={<JoinTrip />} />
              <Route path="/trips/:tripId" element={<TripGallery />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
