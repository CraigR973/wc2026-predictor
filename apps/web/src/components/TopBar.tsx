import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Brand } from '@/components/Brand';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const DESKTOP_NAV = [
  { to: '/', label: 'Home', exact: true },
  { to: '/schedule', label: 'Schedule', exact: false },
  { to: '/predictions', label: 'Predict', exact: false },
  { to: '/bracket', label: 'Bracket', exact: false },
  { to: '/groups', label: 'Groups', exact: false },
  { to: '/leagues', label: 'Leagues', exact: false },
  { to: '/settings', label: 'Settings', exact: false },
  { to: '/about', label: 'About', exact: false },
];

export function TopBar() {
  const { player } = useAuth();

  return (
    <header
      className={cn(
        'sticky top-0 z-header',
        'bg-surface/90 backdrop-blur-md border-b border-border',
        'pt-safe',
      )}
    >
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <NavLink to="/" aria-label="Home" className="press-down">
          <Brand variant="compact" />
        </NavLink>

        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-1">
          {DESKTOP_NAV.map(({ to, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                cn(
                  'px-3 py-1.5 rounded-sm text-sm font-medium font-sans tracking-tight transition-colors press-down',
                  'focus-visible:outline-none focus-visible:shadow-glow',
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated',
                )
              }
            >
              {label}
            </NavLink>
          ))}
          {player?.role === 'admin' && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                cn(
                  'ml-2 px-3 py-1.5 rounded-sm text-sm font-medium font-sans tracking-tight transition-colors press-down',
                  'focus-visible:outline-none focus-visible:shadow-glow',
                  isActive
                    ? 'bg-accent/15 text-accent'
                    : 'text-accent/80 hover:text-accent hover:bg-surface-elevated',
                )
              }
            >
              Admin
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {player?.role === 'admin' && (
            <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full bg-accent/15 text-accent text-[10px] font-mono uppercase tracking-[0.2em]">
              Admin
            </span>
          )}
          {player && (
            <NavLink
              to="/settings"
              aria-label={`Your profile (${player.displayName})`}
              className="inline-flex items-center gap-2 press-down rounded-full focus-visible:outline-none focus-visible:shadow-glow"
            >
              <span className="hidden sm:inline text-sm text-text-secondary font-sans">
                {player.displayName}
              </span>
              <Avatar name={player.displayName} size="sm" />
            </NavLink>
          )}
        </div>
      </div>
    </header>
  );
}
