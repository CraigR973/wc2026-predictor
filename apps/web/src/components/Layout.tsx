import { Outlet } from 'react-router-dom';
import { NavBar } from './NavBar';
import { OfflineBanner } from './OfflineBanner';

export function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <OfflineBanner />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
