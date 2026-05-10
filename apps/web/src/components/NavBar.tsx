import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

const navItems = [
  { to: '/', label: 'Home', exact: true },
  { to: '/schedule', label: 'Schedule', exact: false },
  { to: '/groups', label: 'Groups', exact: false },
];

export function NavBar() {
  const { player, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface/90 backdrop-blur">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <span className="font-display text-xl text-primary tracking-wider select-none">
            WC 2026
          </span>
          <nav className="flex items-center gap-1">
            {navItems.map(({ to, label, exact }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                className={({ isActive }) =>
                  cn(
                    'px-3 py-1.5 rounded-md text-sm font-sans transition-colors',
                    isActive
                      ? 'bg-primary/20 text-primary'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated',
                  )
                }
              >
                {label}
              </NavLink>
            ))}
            {player?.role === 'admin' && (
              <>
                <NavLink
                  to="/admin/invites"
                  className={({ isActive }) =>
                    cn(
                      'px-3 py-1.5 rounded-md text-sm font-sans transition-colors',
                      isActive
                        ? 'bg-primary/20 text-primary'
                        : 'text-text-muted hover:text-text-primary hover:bg-surface-elevated',
                    )
                  }
                >
                  Invites
                </NavLink>
                <NavLink
                  to="/admin/players"
                  className={({ isActive }) =>
                    cn(
                      'px-3 py-1.5 rounded-md text-sm font-sans transition-colors',
                      isActive
                        ? 'bg-primary/20 text-primary'
                        : 'text-text-muted hover:text-text-primary hover:bg-surface-elevated',
                    )
                  }
                >
                  Players
                </NavLink>
              </>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {player?.role === 'admin' && (
            <span className="text-xs text-primary font-mono">[admin]</span>
          )}
          <span className="text-sm text-text-secondary font-sans hidden sm:block">
            {player?.displayName}
          </span>
          <button
            onClick={logout}
            className="text-xs text-text-muted hover:text-text-primary font-sans transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
