import { Outlet, useLocation } from 'react-router-dom';
import { NavBar } from './NavBar';
import { OfflineBanner } from './OfflineBanner';
import { ErrorBoundary } from './ErrorBoundary';
import { PageTransition } from './PageTransition';

export function Layout() {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <OfflineBanner />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <ErrorBoundary key={location.pathname}>
          <PageTransition>
            <Outlet />
          </PageTransition>
        </ErrorBoundary>
      </main>
    </div>
  );
}
